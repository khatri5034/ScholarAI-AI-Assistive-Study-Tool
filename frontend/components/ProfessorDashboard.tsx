"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import { api } from "@/services/api";

type StudentRosterEntry = {
  name: string;
  email?: string;
};

type CourseDoc = {
  id: string;
  courseName: string;
  courseCode: string;
  lmsSource: string;
  students: StudentRosterEntry[];
  createdAt?: Timestamp;
};

type SentAssignment = {
  id: string;
  quizTitle: string;
  recipientEmail: string;
  answersPublished: boolean;
  quizAnswerKey?: string;
  quizBody?: string;
  studentSubmissionAnswers?: Record<string, string>;
  studentSubmissionScore?: number;
  studentSubmissionTotal?: number;
  studentSubmittedAtMs?: number;
  createdAtMs: number;
};

function extractNumberedMap(raw: string): Map<number, string> {
  const out = new Map<number, string>();
  const lines = raw.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)\.\s*(.+)$/);
    if (!m) continue;
    out.set(Number(m[1]), m[2].trim());
  }
  return out;
}

function extractExamQuestionMap(raw: string): Map<number, string> {
  const out = new Map<number, string>();
  const examBody = raw.match(/(?:^|\n)(?:##\s*)?EXAM\b([\s\S]*?)(?:\n(?:##\s*)?ANSWER KEY\b|$)/i)?.[1] ?? raw;
  const blocks = examBody
    .trim()
    .split(/(?=^\d+\.\s)/m)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const m = block.match(/^(\d+)\.\s*([\s\S]+)$/);
    if (!m) continue;
    const number = Number(m[1]);
    const stem = m[2]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !/^[A-D][\).:]\s+/.test(line))
      .join(" ")
      .trim();
    if (stem) out.set(number, stem);
  }
  return out;
}

function buildManualQuizText(
  items: Array<{
    question: string;
    isMcq: boolean;
    options?: string[];
    correctAnswer: string;
  }>,
): string {
  const examLines: string[] = ["EXAM"];
  const keyLines: string[] = ["ANSWER KEY"];
  items.forEach((item, idx) => {
    const qn = idx + 1;
    examLines.push(`${qn}. ${item.question}`);
    if (item.isMcq && item.options) {
      const labels = ["A", "B", "C", "D"];
      item.options.forEach((opt, i) => {
        examLines.push(`${labels[i]}) ${opt}`);
      });
    }
    examLines.push("");
    keyLines.push(`${qn}. ${item.correctAnswer}`);
  });
  return `${examLines.join("\n").trim()}\n\n${keyLines.join("\n").trim()}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRosterInput(raw: string): StudentRosterEntry[] {
  const entries: StudentRosterEntry[] = [];

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line) continue;

    // If a line includes commas and no email at all, treat as list of names:
    // "Alex, Kiran, Nare" -> 3 students.
    if (line.includes(",") && !EMAIL_RE.test(line)) {
      const names = line
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean);
      for (const name of names) {
        entries.push({ name });
      }
      continue;
    }

    const [first, second] = line.includes(",") ? line.split(",", 2) : line.split(/\s+/, 2);
    const left = (first ?? "").trim();
    const right = (second ?? "").trim();
    if (!left) continue;

    if (EMAIL_RE.test(left)) {
      entries.push({ name: "Student", email: left.toLowerCase() });
      continue;
    }
    if (EMAIL_RE.test(right)) {
      entries.push({ name: left || "Student", email: right.toLowerCase() });
      continue;
    }

    // Fallback: name-only row.
    entries.push({ name: line });
  }

  return entries;
}

function errorMessageFor(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = String((err as { code: string }).code);
    if (code === "permission-denied") {
      return "Firestore denied this action. Update rules for /professors/{uid}/courses and /quizAssignments.";
    }
    return `Could not save course (${code}).`;
  }
  return "Could not save course right now. Please try again.";
}

export function ProfessorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authChecked, setAuthChecked] = useState(false);
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [savingCourse, setSavingCourse] = useState(false);

  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [lmsSource, setLmsSource] = useState("");
  const [rosterInput, setRosterInput] = useState("");
  const [studentNameInput, setStudentNameInput] = useState("");
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [message, setMessage] = useState<string>("");
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [openEditorSection, setOpenEditorSection] = useState<null | "course" | "roster" | "quiz">(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizBody, setQuizBody] = useState("");
  const [quizNote, setQuizNote] = useState("");
  const [quizFormat, setQuizFormat] = useState<"mcq" | "short_answer">("mcq");
  const [quizComposeMode, setQuizComposeMode] = useState<"generated" | "manual">("generated");
  const [manualQuestionText, setManualQuestionText] = useState("");
  const [manualIsMcq, setManualIsMcq] = useState(true);
  const [manualOptionA, setManualOptionA] = useState("");
  const [manualOptionB, setManualOptionB] = useState("");
  const [manualOptionC, setManualOptionC] = useState("");
  const [manualOptionD, setManualOptionD] = useState("");
  const [manualCorrectChoice, setManualCorrectChoice] = useState<"A" | "B" | "C" | "D">("A");
  const [manualCorrectShort, setManualCorrectShort] = useState("");
  const [manualQuestions, setManualQuestions] = useState<
    Array<{
      question: string;
      isMcq: boolean;
      options?: string[];
      correctAnswer: string;
    }>
  >([]);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [manualQuizReady, setManualQuizReady] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<"all" | "specific">("all");
  const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
  const [sendingQuiz, setSendingQuiz] = useState(false);
  const [rosterUpdating, setRosterUpdating] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteMode, setInviteMode] = useState<"all" | "specific">("all");
  const [selectedInviteEmail, setSelectedInviteEmail] = useState("");
  const [sentAssignments, setSentAssignments] = useState<SentAssignment[]>([]);
  const [publishingAssignmentId, setPublishingAssignmentId] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      router.replace("/login?next=/professor");
      return;
    }
    setAuthChecked(true);
  }, [router, user]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "professors", user.uid, "courses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: CourseDoc[] = snap.docs.map((d) => {
          const data = d.data() as Omit<CourseDoc, "id">;
          return {
            id: d.id,
            courseName: data.courseName ?? "Untitled course",
            courseCode: data.courseCode ?? "",
            lmsSource: data.lmsSource ?? "",
            students: Array.isArray(data.students) ? data.students : [],
            createdAt: data.createdAt,
          };
        });
        setCourses(next);
      },
      () => {
        setMessage("Firestore denied course access. Update rules for /professors/{uid}/courses.");
      },
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!courses.length) {
      setSelectedCourseId("");
      return;
    }
    setSelectedCourseId((prev) => (prev && courses.some((c) => c.id === prev) ? prev : ""));
  }, [courses]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  const parsedStudents = useMemo(() => parseRosterInput(rosterInput), [rosterInput]);
  const totalStudents = courses.reduce((acc, course) => acc + course.students.length, 0);
  const displayedStudentCount = selectedCourse ? selectedCourse.students.length : totalStudents;
  const selectedCourseRosterWithEmail = useMemo(
    () => (selectedCourse?.students ?? []).filter((s) => !!s.email?.trim()),
    [selectedCourse],
  );
  const rosterCandidatesWithEmail = useMemo(() => {
    const fromForm = parsedStudents.filter((s) => !!s.email?.trim());
    const source =
      editingCourseId && selectedCourse && editingCourseId === selectedCourse.id
        ? fromForm
        : selectedCourseRosterWithEmail;
    const seen = new Set<string>();
    return source.filter((s) => {
      const key = s.email!.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [editingCourseId, parsedStudents, selectedCourse, selectedCourseRosterWithEmail]);

  useEffect(() => {
    if (!user?.uid || !selectedCourse?.id) {
      setSentAssignments([]);
      return;
    }
    const q = query(
      collection(db, "quizAssignments"),
      where("professorId", "==", user.uid),
      where("courseId", "==", selectedCourse.id),
      where("status", "==", "sent"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all: SentAssignment[] = snap.docs.map((d) => {
          const data = d.data() as Partial<SentAssignment>;
          const createdAtValue = (d.data() as { createdAt?: { toMillis?: () => number } }).createdAt;
          return {
            id: d.id,
            quizTitle: data.quizTitle ?? "Assigned quiz",
            recipientEmail: data.recipientEmail ?? "",
            answersPublished: !!data.answersPublished,
            quizAnswerKey: data.quizAnswerKey ?? "",
            quizBody: (d.data() as { quizBody?: string }).quizBody ?? "",
            studentSubmissionAnswers:
              (d.data() as { studentSubmissionAnswers?: Record<string, string> }).studentSubmissionAnswers ??
              {},
            studentSubmissionScore:
              (d.data() as { studentSubmissionScore?: number }).studentSubmissionScore,
            studentSubmissionTotal:
              (d.data() as { studentSubmissionTotal?: number }).studentSubmissionTotal,
            studentSubmittedAtMs:
              typeof (d.data() as { studentSubmittedAt?: { toMillis?: () => number } }).studentSubmittedAt
                ?.toMillis === "function"
                ? (d.data() as { studentSubmittedAt?: { toMillis?: () => number } }).studentSubmittedAt!.toMillis()
                : undefined,
            createdAtMs: typeof createdAtValue?.toMillis === "function" ? createdAtValue.toMillis() : 0,
          };
        });
        const next = all.sort((a, b) => {
          const aSubmitted = typeof a.studentSubmittedAtMs === "number" ? a.studentSubmittedAtMs : 0;
          const bSubmitted = typeof b.studentSubmittedAtMs === "number" ? b.studentSubmittedAtMs : 0;
          if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
          return b.createdAtMs - a.createdAtMs;
        });
        setSentAssignments(next);
      },
      () => {
        setSentAssignments([]);
        setMessage("Could not load sent quizzes. Check Firestore rules/indexes for quizAssignments.");
      },
    );
    return () => unsub();
  }, [selectedCourse?.id, user?.uid]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      setMessage("Sign in first to create courses.");
      return;
    }
    if (!courseName.trim()) {
      setMessage("Course name is required.");
      return;
    }
    if (!lmsSource.trim()) {
      setMessage("Please mention LMS source (Canvas, Moodle, Blackboard, etc.).");
      return;
    }
    if (!parsedStudents.length) {
      setMessage("Add at least one valid student row before creating the course.");
      return;
    }

    setSavingCourse(true);
    setMessage("");
    try {
      if (editingCourseId) {
        await updateDoc(doc(db, "professors", user.uid, "courses", editingCourseId), {
          courseName: courseName.trim(),
          courseCode: courseCode.trim(),
          lmsSource: lmsSource.trim(),
          students: parsedStudents,
          updatedAt: serverTimestamp(),
        });
        setMessage("Course updated.");
      } else {
        await addDoc(collection(db, "professors", user.uid, "courses"), {
          courseName: courseName.trim(),
          courseCode: courseCode.trim(),
          lmsSource: lmsSource.trim(),
          students: parsedStudents,
          createdAt: serverTimestamp(),
        });
        setMessage("Course created and roster imported.");
        setCourseName("");
        setCourseCode("");
        setLmsSource("");
        setRosterInput("");
        setEditingCourseId(null);
        setShowCourseForm(false);
      }
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setSavingCourse(false);
    }
  };

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setSelectedCourseId("");
    setShowCourseForm(false);
    setOpenEditorSection(null);
    setCourseName("");
    setCourseCode("");
    setLmsSource("");
    setRosterInput("");
    setMessage("");
  };

  const openCreateCourseForm = () => {
    setEditingCourseId(null);
    setSelectedCourseId("");
    setShowCourseForm(true);
    setOpenEditorSection("course");
    setCourseName("");
    setCourseCode("");
    setLmsSource("");
    setRosterInput("");
    setMessage("");
  };

  const openCourseForEdit = (course: CourseDoc) => {
    if (selectedCourseId === course.id && showCourseForm) {
      setShowCourseForm(false);
      setSelectedCourseId("");
      setEditingCourseId(null);
      setOpenEditorSection(null);
      return;
    }
    setSelectedCourseId(course.id);
    setEditingCourseId(course.id);
    setShowCourseForm(true);
    setOpenEditorSection("course");
    setCourseName(course.courseName);
    setCourseCode(course.courseCode);
    setLmsSource(course.lmsSource);
    setRosterInput(course.students.map((s) => (s.email ? `${s.name}, ${s.email}` : s.name)).join("\n"));
    setMessage("");
  };

  const handleAssignQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      setMessage("Sign in first to assign quizzes.");
      return;
    }
    if (!selectedCourse) {
      setMessage("Pick a course first.");
      return;
    }
    const effectiveQuizBody =
      quizComposeMode === "manual" && manualQuestions.length > 0
        ? buildManualQuizText(manualQuestions)
        : quizBody.trim();
    if (!quizTitle.trim() || !effectiveQuizBody.trim()) {
      setMessage("Quiz title and quiz content are required.");
      return;
    }
    if (!rosterCandidatesWithEmail.length) {
      setMessage("This course has no student emails. Add roster emails to assign quizzes.");
      return;
    }

    const recipients =
      assignmentMode === "all"
        ? rosterCandidatesWithEmail
        : rosterCandidatesWithEmail.filter(
            (student) => student.email!.toLowerCase() === selectedStudentEmail.toLowerCase(),
          );

    if (!recipients.length) {
      setMessage("Choose a valid student email from the roster.");
      return;
    }

    setSendingQuiz(true);
    setMessage("");
    try {
      const split = effectiveQuizBody.split(/\n(?=ANSWER KEY\b|##\s*ANSWER KEY\b)/i);
      const studentQuizBody = (split[0] ?? effectiveQuizBody).trim();
      const answerKeyPart =
        split.length > 1
          ? split
              .slice(1)
              .join("\n")
              .replace(/^##\s*ANSWER KEY\b/i, "")
              .replace(/^ANSWER KEY\b/i, "")
              .trim()
          : "";

      await Promise.all(
        recipients.map((student) =>
          addDoc(collection(db, "quizAssignments"), {
            professorId: user.uid,
            professorName: user.displayName ?? user.email ?? "Professor",
            courseId: selectedCourse.id,
            courseName: selectedCourse.courseName,
            recipientName: student.name,
            recipientEmail: student.email,
            recipientEmailLower: student.email!.toLowerCase(),
            quizTitle: quizTitle.trim(),
            quizBodyStudent: studentQuizBody,
            quizBody: studentQuizBody,
            quizAnswerKey: answerKeyPart,
            answersPublished: false,
            studentOpened: false,
            note: quizNote.trim(),
            status: "sent",
            createdAt: serverTimestamp(),
          }),
        ),
      );
      setQuizTitle("");
      setQuizBody("");
      setQuizNote("");
      setManualQuizReady(false);
      setManualQuestions([]);
      setManualQuestionText("");
      setManualOptionA("");
      setManualOptionB("");
      setManualOptionC("");
      setManualOptionD("");
      setManualCorrectShort("");
      setManualCorrectChoice("A");
      setSelectedStudentEmail("");
      setAssignmentMode("all");
      setMessage(
        assignmentMode === "all"
          ? `Quiz sent to ${recipients.length} students.`
          : `Quiz sent to ${recipients[0]?.name ?? "student"}.`,
      );
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setSendingQuiz(false);
    }
  };

  const toggleAnswersPublish = async (assignment: SentAssignment) => {
    if (!assignment.answersPublished && !assignment.quizAnswerKey?.trim()) {
      setMessage("No answer key found in this quiz to publish.");
      return;
    }
    setPublishingAssignmentId(assignment.id);
    setMessage("");
    try {
      await updateDoc(doc(db, "quizAssignments", assignment.id), {
        answersPublished: !assignment.answersPublished,
        answersPublishedAt: !assignment.answersPublished ? serverTimestamp() : null,
      });
      setMessage(
        assignment.answersPublished
          ? "Answer key unpublished for that quiz."
          : "Answer key published for that quiz.",
      );
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setPublishingAssignmentId(null);
    }
  };

  const handleAddStudentToRoster = () => {
    const name = studentNameInput.trim();
    const email = studentEmailInput.trim().toLowerCase();
    if (!name) {
      setMessage("Student name is required.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setMessage("Enter a valid student email.");
      return;
    }

    const line = `${name}, ${email}`;
    const existingLines = rosterInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (existingLines.some((l) => l.toLowerCase() === line.toLowerCase())) {
      setMessage("That student is already in roster input.");
      return;
    }
    setRosterInput((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
    setStudentNameInput("");
    setStudentEmailInput("");
    setMessage("Student added to roster input.");
  };

  const handleGenerateQuiz = async () => {
    if (!user?.uid) {
      setMessage("Sign in first to generate quiz.");
      return;
    }
    if (!selectedCourse) {
      setMessage("Pick a course first.");
      return;
    }
    if (!quizTitle.trim()) {
      setMessage("Add a quiz title first. I generate questions around that title.");
      return;
    }
    setGeneratingQuiz(true);
    setMessage("");
    try {
      const topicTitle = quizTitle.trim();
      const prompt = `Create a ${quizFormat === "mcq" ? "multiple-choice" : "short-answer"} quiz around this title/topic: "${topicTitle}".
Course context: "${selectedCourse.courseName}".
Focus primarily on the title/topic and include answer key.`;
      const data = await api.runAgent({
        message: prompt,
        userId: user.uid,
        topic: topicTitle,
        mode: "quiz",
        quiz_format: quizFormat,
      });
      setQuizBody(data.answer?.trim() || "");
      setMessage("Quiz generated. Review and send when ready.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Quiz generation failed.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const rebuildManualQuizBody = (
    items: Array<{
      question: string;
      isMcq: boolean;
      options?: string[];
      correctAnswer: string;
    }>,
  ) => {
    setQuizBody(buildManualQuizText(items));
  };

  const handleAddManualQuestion = () => {
    if (!manualQuestionText.trim()) {
      setMessage("Type the question text first.");
      return;
    }
    if (manualIsMcq) {
      const opts = [
        manualOptionA.trim(),
        manualOptionB.trim(),
        manualOptionC.trim(),
        manualOptionD.trim(),
      ];
      if (opts.some((x) => !x)) {
        setMessage("For MCQ, fill options A, B, C, and D.");
        return;
      }
      const choiceIndex = { A: 0, B: 1, C: 2, D: 3 }[manualCorrectChoice];
      const correctValue = `${manualCorrectChoice}) ${opts[choiceIndex]}`;
      const next = [
        ...manualQuestions,
        {
          question: manualQuestionText.trim(),
          isMcq: true,
          options: opts,
          correctAnswer: correctValue,
        },
      ];
      setManualQuestions(next);
      rebuildManualQuizBody(next);
    } else {
      if (!manualCorrectShort.trim()) {
        setMessage("Add the correct answer for this short-answer question.");
        return;
      }
      const next = [
        ...manualQuestions,
        {
          question: manualQuestionText.trim(),
          isMcq: false,
          correctAnswer: manualCorrectShort.trim(),
        },
      ];
      setManualQuestions(next);
      rebuildManualQuizBody(next);
    }
    setManualQuestionText("");
    setManualOptionA("");
    setManualOptionB("");
    setManualOptionC("");
    setManualOptionD("");
    setManualCorrectChoice("A");
    setManualCorrectShort("");
    setManualQuizReady(false);
    setMessage("Question added to manual quiz.");
  };

  const handleManualDone = () => {
    if (manualQuestions.length === 0) {
      setMessage("Add at least one manual question before clicking Done.");
      return;
    }
    const built = buildManualQuizText(manualQuestions);
    setQuizBody(built);
    setManualQuizReady(true);
    setMessage("Manual quiz is ready. You can now send it to students.");
  };

  const handleRemoveStudent = async (student: StudentRosterEntry) => {
    if (!user?.uid || !selectedCourse) return;
    setRosterUpdating(true);
    setMessage("");
    try {
      const nextStudents = selectedCourse.students.filter((s) =>
        s.email
          ? !(s.email === student.email && s.name === student.name)
          : !(s.name === student.name && !s.email),
      );
      await updateDoc(doc(db, "professors", user.uid, "courses", selectedCourse.id), {
        students: nextStudents,
      });
      setMessage(`Removed ${student.name} from roster.`);
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setRosterUpdating(false);
    }
  };

  const handleSendInvitations = async () => {
    if (!user?.uid) {
      setMessage("Sign in first to send invitations.");
      return;
    }
    if (!selectedCourse) {
      setMessage("Pick a course first.");
      return;
    }
    if (!rosterCandidatesWithEmail.length) {
      setMessage("No student emails available to invite.");
      return;
    }
    const recipients =
      inviteMode === "all"
        ? rosterCandidatesWithEmail
        : rosterCandidatesWithEmail.filter(
            (student) => student.email!.toLowerCase() === selectedInviteEmail.toLowerCase(),
          );
    if (!recipients.length) {
      setMessage("Choose a valid student email for invitation.");
      return;
    }

    setSendingInvites(true);
    setMessage("");
    try {
      await Promise.all(
        recipients.map((student) =>
          addDoc(collection(db, "courseInvitations"), {
            professorId: user.uid,
            professorName: user.displayName ?? user.email ?? "Professor",
            courseId: selectedCourse.id,
            courseName: selectedCourse.courseName,
            studentName: student.name,
            studentEmail: student.email,
            studentEmailLower: student.email!.toLowerCase(),
            status: "pending",
            createdAt: serverTimestamp(),
          }),
        ),
      );
      setMessage(
        inviteMode === "all"
          ? `Invitations sent to ${recipients.length} students.`
          : `Invitation sent to ${recipients[0]?.email}.`,
      );
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setSendingInvites(false);
    }
  };

  const handleClearRoster = async () => {
    if (!user?.uid || !selectedCourse) return;
    if (!confirm(`Clear all students from "${selectedCourse.courseName}" roster?`)) return;
    setRosterUpdating(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "professors", user.uid, "courses", selectedCourse.id), {
        students: [],
      });
      setMessage("Roster cleared.");
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setRosterUpdating(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!user?.uid || !selectedCourse) return;
    if (
      !confirm(
        `Delete course "${selectedCourse.courseName}" and its roster?\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    setRosterUpdating(true);
    setMessage("");
    try {
      await deleteDoc(doc(db, "professors", user.uid, "courses", selectedCourse.id));
      setMessage("Course deleted.");
    } catch (err) {
      setMessage(errorMessageFor(err));
    } finally {
      setRosterUpdating(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-300">
        Checking account access...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl shadow-black/20">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">Professor Dashboard</h2>
        <p className="mt-2 text-slate-400">Register courses and import students from your LMS export.</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <p className="text-sm text-indigo-100/95">
            You can still upload course files for topic-specific chat, planner, and quiz support.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
          >
            Upload files
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Courses</p>
          <p className="mt-2 text-xl font-semibold text-white">{courses.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {selectedCourse ? "Students in selected course" : "Total enrolled students"}
          </p>
          <p className="mt-2 text-xl font-semibold text-white">{displayedStudentCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">LMS integration</p>
          <p className="mt-2 text-sm text-slate-300">
            Paste rows in `Name, email@school.edu` format, or email-only rows from CSV exports.
          </p>
        </div>
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[1.7fr,1fr]">
        <div className="self-start rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-white">
              {editingCourseId ? "Edit Registered Course" : "Register a Course"}
            </h3>
            {!showCourseForm ? (
              <button
                type="button"
                onClick={openCreateCourseForm}
                className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-500/25"
              >
                Register a course
              </button>
            ) : (
              <button
                type="button"
                onClick={resetCourseForm}
                className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
              >
                Close form
              </button>
            )}
          </div>
          {showCourseForm && editingCourseId && (
            <p className="mt-2 text-xs text-amber-200/90">Editing selected course.</p>
          )}

          {showCourseForm ? (
            <div className="mt-4 space-y-4">
            <section className="rounded-xl border border-slate-700/70 bg-slate-900/40">
              <button
                type="button"
                onClick={() => setOpenEditorSection((prev) => (prev === "course" ? null : "course"))}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-slate-100">Course details</span>
                <span className="text-xs text-slate-400">{openEditorSection === "course" ? "Hide" : "Open"}</span>
              </button>
              {openEditorSection === "course" && (
                <form onSubmit={handleCreateCourse} className="space-y-4 border-t border-slate-800 px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-300" htmlFor="course-name">
                  Course name
                </label>
                <input
                  id="course-name"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Intro to Machine Learning"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300" htmlFor="course-code">
                  Course code (optional)
                </label>
                <input
                  id="course-code"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="CS 561"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300" htmlFor="lms-source">
                LMS source
              </label>
              <input
                id="lms-source"
                value={lmsSource}
                onChange={(e) => setLmsSource(e.target.value)}
                placeholder="Canvas export"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300" htmlFor="lms-roster">
                Student roster (CSV rows or lines)
              </label>
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
                <input
                  type="text"
                  value={studentNameInput}
                  onChange={(e) => setStudentNameInput(e.target.value)}
                  placeholder="Student name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                />
                <input
                  type="email"
                  value={studentEmailInput}
                  onChange={(e) => setStudentEmailInput(e.target.value)}
                  placeholder="student@school.edu"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddStudentToRoster}
                  className="rounded-xl border border-violet-500/35 bg-violet-500/15 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
                >
                  Add student
                </button>
              </div>
              <textarea
                id="lms-roster"
                value={rosterInput}
                onChange={(e) => setRosterInput(e.target.value)}
                rows={8}
                placeholder={"Alice Johnson, alice@school.edu\nbob@school.edu\nAlex, Kiran, Nare"}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
              <p className="mt-2 text-xs text-slate-500">Parsed students: {parsedStudents.length}</p>
            </div>

            {editingCourseId && rosterCandidatesWithEmail.length > 0 && (
              <div className="space-y-2 rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200/90">
                  Send Course Invitation
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteMode("all")}
                    className={`rounded-md px-2.5 py-1 text-xs ${inviteMode === "all" ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-slate-800 text-slate-300"}`}
                  >
                    Invite all
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteMode("specific")}
                    className={`rounded-md px-2.5 py-1 text-xs ${inviteMode === "specific" ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-slate-800 text-slate-300"}`}
                  >
                    Invite specific
                  </button>
                </div>
                {inviteMode === "specific" && (
                  <select
                    value={selectedInviteEmail}
                    onChange={(e) => setSelectedInviteEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none"
                  >
                    <option value="">Select student email</option>
                    {rosterCandidatesWithEmail.map((student) => (
                      <option key={`invite-inline-${student.email}-${student.name}`} value={student.email}>
                        {student.email} - {student.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => void handleSendInvitations()}
                  disabled={sendingInvites}
                  className="rounded-md border border-indigo-500/35 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-60"
                >
                  {sendingInvites ? "Sending invites..." : "Send course invitation"}
                </button>
              </div>
            )}

            {message && <p className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">{message}</p>}

            <button
              type="submit"
              disabled={savingCourse}
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
            >
              {savingCourse ? "Saving..." : editingCourseId ? "Update course" : "Create course and add students"}
            </button>
                </form>
              )}
            </section>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              Click <span className="text-slate-200">Register a course</span> to open the form.
            </p>
          )}

          {showCourseForm && selectedCourse && (
            <div className="mt-6 space-y-5 border-t border-slate-800 pt-5">
              <section className="rounded-xl border border-slate-700/70 bg-slate-900/40">
                <button
                  type="button"
                  onClick={() => setOpenEditorSection((prev) => (prev === "roster" ? null : "roster"))}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-slate-100">Roster</span>
                  <span className="text-xs text-slate-400">{openEditorSection === "roster" ? "Hide" : "Open"}</span>
                </button>
                {openEditorSection === "roster" && (
                  <div className="border-t border-slate-800 px-4 py-4">
                    <div className="mb-4 space-y-2 rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200/90">
                        Course Invitations
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setInviteMode("all")}
                          className={`rounded-md px-2.5 py-1 text-xs ${inviteMode === "all" ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-slate-800 text-slate-300"}`}
                        >
                          Invite all
                        </button>
                        <button
                          type="button"
                          onClick={() => setInviteMode("specific")}
                          className={`rounded-md px-2.5 py-1 text-xs ${inviteMode === "specific" ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-slate-800 text-slate-300"}`}
                        >
                          Invite specific
                        </button>
                      </div>
                      {inviteMode === "specific" && (
                        <select
                          value={selectedInviteEmail}
                          onChange={(e) => setSelectedInviteEmail(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none"
                        >
                          <option value="">Select student email</option>
                          {rosterCandidatesWithEmail.map((student) => (
                            <option key={`invite-${student.email}-${student.name}`} value={student.email}>
                              {student.email} - {student.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSendInvitations()}
                        disabled={sendingInvites}
                        className="rounded-md border border-indigo-500/35 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-60"
                      >
                        {sendingInvites ? "Sending invites..." : "Send course invitation"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-base font-semibold text-white">Roster</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleClearRoster()}
                      disabled={rosterUpdating || selectedCourse.students.length === 0}
                      className="rounded-md border border-red-500/35 bg-red-500/15 px-2.5 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Clear roster
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCourse()}
                      disabled={rosterUpdating}
                      className="rounded-md border border-red-600/45 bg-red-600/20 px-2.5 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-600/30 disabled:opacity-50"
                    >
                      Delete course
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedCourse.courseName} • {selectedCourse.lmsSource}
                </p>
                <ul className="mt-3 max-h-56 space-y-2 overflow-auto pr-1 text-sm">
                  {selectedCourse.students.map((student) => (
                    <li key={`${student.email ?? "no-email"}-${student.name}`} className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-100">{student.name}</p>
                          <p className="text-xs text-slate-400">{student.email ?? "No email provided"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveStudent(student)}
                          disabled={rosterUpdating}
                          className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-amber-500/25 bg-amber-500/5">
                <button
                  type="button"
                  onClick={() => setOpenEditorSection((prev) => (prev === "quiz" ? null : "quiz"))}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-amber-100">Quiz assignment</span>
                  <span className="text-xs text-amber-100/70">{openEditorSection === "quiz" ? "Hide" : "Open"}</span>
                </button>
                {openEditorSection === "quiz" && (
                  <div className="space-y-3 border-t border-amber-500/20 p-4">
                    <p className="text-xs text-amber-100/80">
                      Assign quiz to all students or a selected roster student (email-matched delivery).
                    </p>
                    <form onSubmit={handleAssignQuiz} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-200" htmlFor="quiz-title">
                      Quiz title
                    </label>
                    <input
                      id="quiz-title"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="Quiz 1 - Linear Regression"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-300">Create mode</label>
                    <button
                      type="button"
                      onClick={() => setQuizComposeMode("generated")}
                      className={`rounded-md px-2.5 py-1 text-xs ${
                        quizComposeMode === "generated"
                          ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-500/35"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      Generated quiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuizComposeMode("manual")}
                      className={`rounded-md px-2.5 py-1 text-xs ${
                        quizComposeMode === "manual"
                          ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-500/35"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      Make quiz manually
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-300">Format</label>
                    <button
                      type="button"
                      onClick={() => setQuizFormat("mcq")}
                      className={`rounded-md px-2.5 py-1 text-xs ${quizFormat === "mcq" ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/35" : "bg-slate-800 text-slate-300"}`}
                    >
                      MCQ
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuizFormat("short_answer")}
                      className={`rounded-md px-2.5 py-1 text-xs ${quizFormat === "short_answer" ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/35" : "bg-slate-800 text-slate-300"}`}
                    >
                      Short answer
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateQuiz()}
                      disabled={generatingQuiz || quizComposeMode !== "generated"}
                      className="rounded-md border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
                    >
                      {generatingQuiz ? "Generating..." : "Generate with quiz generator"}
                    </button>
                  </div>
                  {quizComposeMode === "manual" && (
                    <div className="space-y-3 rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200/90">
                        Manual question builder
                      </p>
                      <textarea
                        value={manualQuestionText}
                        onChange={(e) => setManualQuestionText(e.target.value)}
                        rows={2}
                        placeholder="Type question text"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setManualIsMcq(true)}
                          className={`rounded-md px-2.5 py-1 text-xs ${
                            manualIsMcq ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          Multiple choice
                        </button>
                        <button
                          type="button"
                          onClick={() => setManualIsMcq(false)}
                          className={`rounded-md px-2.5 py-1 text-xs ${
                            !manualIsMcq ? "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40" : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          Short answer
                        </button>
                      </div>
                      {manualIsMcq ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input value={manualOptionA} onChange={(e) => setManualOptionA(e.target.value)} placeholder="Option A" className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none" />
                          <input value={manualOptionB} onChange={(e) => setManualOptionB(e.target.value)} placeholder="Option B" className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none" />
                          <input value={manualOptionC} onChange={(e) => setManualOptionC(e.target.value)} placeholder="Option C" className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none" />
                          <input value={manualOptionD} onChange={(e) => setManualOptionD(e.target.value)} placeholder="Option D" className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none" />
                          <select
                            value={manualCorrectChoice}
                            onChange={(e) => setManualCorrectChoice(e.target.value as "A" | "B" | "C" | "D")}
                            className="rounded-lg border border-indigo-500/35 bg-slate-900/80 px-3 py-2 text-xs text-indigo-100 focus:border-indigo-400/50 focus:outline-none"
                          >
                            <option value="A">Correct: A</option>
                            <option value="B">Correct: B</option>
                            <option value="C">Correct: C</option>
                            <option value="D">Correct: D</option>
                          </select>
                        </div>
                      ) : (
                        <input
                          value={manualCorrectShort}
                          onChange={(e) => setManualCorrectShort(e.target.value)}
                          placeholder="Correct short answer"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none"
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleAddManualQuestion}
                        className="rounded-md border border-indigo-500/35 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
                      >
                        Add question
                      </button>
                      <button
                        type="button"
                        onClick={handleManualDone}
                        disabled={manualQuestions.length === 0}
                        className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        Done (ready to send)
                      </button>
                      {manualQuestions.length > 0 && (
                        <p className="text-xs text-indigo-100/80">
                          Added questions: {manualQuestions.length}. Quiz content + answer key auto-generated below.
                        </p>
                      )}
                      {manualQuizReady && (
                        <p className="text-xs text-emerald-200/90">
                          Manual quiz ready. Use Send quiz to all/specific student below.
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm text-slate-200" htmlFor="quiz-body">
                      Quiz content
                    </label>
                    <textarea
                      id="quiz-body"
                      rows={8}
                      value={quizBody}
                      onChange={(e) => setQuizBody(e.target.value)}
                      placeholder={"1. What is gradient descent?\n2. Explain overfitting in 3 lines."}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-200" htmlFor="quiz-note">
                      Message to students (optional)
                    </label>
                    <textarea
                      id="quiz-note"
                      rows={2}
                      value={quizNote}
                      onChange={(e) => setQuizNote(e.target.value)}
                      placeholder="Please submit by Friday 5 PM."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assign to</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignmentMode("all")}
                        className={`rounded-lg px-3 py-2 text-sm ${assignmentMode === "all" ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/35" : "bg-slate-800 text-slate-300"}`}
                      >
                        All students
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentMode("specific")}
                        className={`rounded-lg px-3 py-2 text-sm ${assignmentMode === "specific" ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/35" : "bg-slate-800 text-slate-300"}`}
                      >
                        Specific student
                      </button>
                    </div>
                    {assignmentMode === "specific" && (
                      <div className="space-y-2">
                        <select
                          value={selectedStudentEmail}
                          onChange={(e) => setSelectedStudentEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                        >
                          <option value="">Select student by email</option>
                          {rosterCandidatesWithEmail.map((student) => (
                            <option key={`${student.email}-${student.name}`} value={student.email}>
                              {student.email} - {student.name}
                            </option>
                          ))}
                        </select>
                        {rosterCandidatesWithEmail.length === 0 && (
                          <p className="text-xs text-rose-300">
                            No student emails found yet. Add `Name + Email` in Course details and click Update course.
                          </p>
                        )}
                        {selectedStudentEmail && (
                          <p className="text-xs text-amber-100/90">
                            Sending to: <span className="font-medium">{selectedStudentEmail}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={sendingQuiz || (quizComposeMode === "manual" && !manualQuizReady)}
                    className="rounded-lg border border-amber-500/35 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
                  >
                    {sendingQuiz ? "Sending..." : assignmentMode === "all" ? "Send quiz to all students" : "Send quiz to selected student"}
                  </button>
                    </form>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-700/70 bg-slate-900/40">
                <div className="border-b border-slate-800 px-4 py-3">
                  <h4 className="text-sm font-semibold text-slate-100">Sent quizzes (latest first)</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Use Publish/Unpublish and View submission to review each student.
                  </p>
                </div>
                <div className="space-y-2 px-4 py-4">
                  {sentAssignments.length === 0 ? (
                    <p className="text-xs text-slate-500">No sent quizzes yet for this course.</p>
                  ) : (
                    sentAssignments.map((item) => (
                      <div
                        key={item.id}
                        className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-100">{item.quizTitle}</p>
                            <p className="text-xs text-slate-400">{item.recipientEmail}</p>
                            {typeof item.studentSubmissionScore === "number" &&
                            typeof item.studentSubmissionTotal === "number" ? (
                              <p className="mt-1 text-xs text-emerald-300">
                                Score: {item.studentSubmissionScore}/{item.studentSubmissionTotal}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-slate-500">No student submission yet.</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleAnswersPublish(item)}
                            disabled={publishingAssignmentId === item.id}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                              item.answersPublished
                                ? "border-slate-500/50 bg-slate-700/40 text-slate-100 hover:bg-slate-700/60"
                                : "border-amber-500/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                            }`}
                          >
                            {publishingAssignmentId === item.id
                              ? item.answersPublished
                                ? "Unpublishing..."
                                : "Publishing..."
                              : item.answersPublished
                                ? "Unpublish"
                                : "Publish"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSubmissionId((prev) => (prev === item.id ? null : item.id))
                            }
                            className="rounded-md border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
                          >
                            {expandedSubmissionId === item.id ? "Hide submission" : "View submission"}
                          </button>
                        </div>
                        {expandedSubmissionId === item.id && (
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2">
                            {item.studentSubmissionAnswers &&
                            Object.keys(item.studentSubmissionAnswers).length > 0 ? (
                              <>
                                <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
                                  Student response details
                                </p>
                                <ul className="space-y-2 text-xs text-slate-300">
                                  {Array.from(
                                    new Set([
                                      ...Object.keys(item.studentSubmissionAnswers ?? {}).map((k) => Number(k)),
                                      ...Array.from(extractExamQuestionMap(item.quizBody ?? "").keys()),
                                    ]),
                                  )
                                    .filter((n) => Number.isFinite(n))
                                    .sort((a, b) => a - b)
                                    .map((qNum) => {
                                      const question = extractExamQuestionMap(item.quizBody ?? "").get(qNum) ?? "";
                                      const studentAnswer = item.studentSubmissionAnswers?.[String(qNum)] ?? "";
                                      const key = extractNumberedMap(item.quizAnswerKey ?? "").get(qNum) ?? "";
                                      return (
                                        <li key={`${item.id}-q-${qNum}`} className="rounded border border-slate-800 px-2 py-2">
                                          <p className="font-semibold text-slate-100">Q{qNum}</p>
                                          {question && <p className="mt-1 text-slate-300">{question}</p>}
                                          <p className="mt-1">
                                            Student: <span className="text-slate-100">{studentAnswer || "No answer"}</span>
                                          </p>
                                          <p className="mt-1">
                                            Correct: <span className="text-emerald-300">{key || "N/A"}</span>
                                          </p>
                                        </li>
                                      );
                                    })}
                                </ul>
                              </>
                            ) : (
                              <p className="text-xs text-slate-500">No submitted answers for this student yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-lg shadow-black/20">
            <h3 className="font-display text-lg font-semibold text-white">Registered Courses</h3>
            {courses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No courses yet. Create one on the left.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => openCourseForEdit(course)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      selectedCourseId === course.id
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
                        : "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{course.courseName}</p>
                      <span className="text-xs text-slate-400">
                        {selectedCourseId === course.id && showCourseForm ? "Hide" : "Edit"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {course.courseCode || "No code"} • {course.students.length} students
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

      <p className="rounded-xl border border-slate-800/80 bg-slate-900/35 px-4 py-3 text-xs text-slate-400">
        Next step: connect LMS APIs directly so roster import can be one-click instead of paste.
      </p>
    </div>
  );
}

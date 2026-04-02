"use client";

/**
 * OAuth-style buttons shared by login/signup. Only Google is wired; others stay as UI
 * stubs so the grid matches a “real” auth product without blocking the capstone.
 */

export type ProviderType = "google" | "github" | "microsoft" | "linkedin";

/* ---------------- ICONS ---------------- */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.21 11.39c.6.11.79-.26.79-.58v-2.2c-3.34.73-4.03-1.42-4.03-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.72.08-.72 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.49 1 .11-.77.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23.96-.27 1.98-.4 3-.4 1.02 0 2.04.13 3 .4 2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.57A12 12 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M1 13h10v10H1z" />
      <path fill="#7fba00" d="M13 1h10v10H13z" />
      <path fill="#ffb900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z" />
    </svg>
  );
}

/* ---------------- PROVIDERS ---------------- */

const providers = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
  { id: "microsoft", label: "Microsoft", Icon: MicrosoftIcon },
  { id: "linkedin", label: "LinkedIn", Icon: LinkedInIcon },
] as const;

/* ---------------- COMPONENT ---------------- */

type AuthProvidersProps = {
  variant: "login" | "signup";
  onProviderClick: (provider: ProviderType) => void;
  loadingProvider: ProviderType | null;
};

export function AuthProviders({
  variant,
  onProviderClick,
  loadingProvider,
}: AuthProvidersProps) {
  const text = variant === "login" ? "Log in with" : "Sign up with";

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-slate-400">{text}</p>

      <div className="grid grid-cols-2 gap-2">
        {providers.map(({ id, label, Icon }) => {
          const isLoading = loadingProvider === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onProviderClick(id)}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 py-2.5 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-60"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Icon className="h-5 w-5" />
              )}

              {isLoading ? "Connecting..." : label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
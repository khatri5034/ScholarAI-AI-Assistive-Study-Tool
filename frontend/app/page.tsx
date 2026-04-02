/**
 * Home route: thin server wrapper so marketing vs. authenticated dashboard logic stays in a client component.
 */

import { HomePageClient } from "@/components/HomePageClient";

export default function HomePage() {
  return <HomePageClient />;
}

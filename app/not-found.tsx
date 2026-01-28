import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <h1>Not Found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <p>
        <Link href="/">← Back to home</Link>
      </p>
    </div>
  );
}

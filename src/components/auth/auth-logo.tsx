import Link from "next/link";

export function AuthLogo() {
  return <Link href="/" className="inline-flex items-center gap-3 text-base font-semibold tracking-[-0.025em] text-ink"><span className="grid h-8 w-8 place-items-center rounded-[0.6rem] bg-accent text-sm font-bold text-white" aria-hidden="true">A</span><span>Atlas Innove</span></Link>;
}

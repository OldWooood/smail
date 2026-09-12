import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface CopyButtonProps {
	content: string;
	children?: ReactNode;
	className?: string;
	variant?: "default" | "secondary" | "outline" | "ghost";
	size?: "default" | "sm" | "lg" | "icon";
}

async function writeClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// fall through to legacy fallback below
	}
	// Fallback for non-secure contexts / older browsers.
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}

export function CopyButton({
	content,
	children,
	className,
	variant = "secondary",
	size = "default",
}: CopyButtonProps) {
	const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	async function copy() {
		if (timerRef.current) clearTimeout(timerRef.current);
		const ok = await writeClipboard(content);
		setStatus(ok ? "copied" : "failed");
		timerRef.current = setTimeout(() => setStatus("idle"), 2000);
		if (!ok) console.error("Copy to clipboard failed");
	}

	return (
		<Button
			variant={variant}
			size={size}
			onClick={copy}
			className={cn("gap-2 transition-all duration-200", className)}
			aria-live="polite"
		>
			{status === "copied" ? (
				<Check className="h-4 w-4 text-emerald-500" />
			) : (
				<Copy className="h-4 w-4" />
			)}
			{children}
			<span className="sr-only">
				{status === "copied" ? "copied" : status === "failed" ? "copy failed" : ""}
			</span>
		</Button>
	);
}

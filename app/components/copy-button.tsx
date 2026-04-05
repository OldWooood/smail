import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface CopyButtonProps {
	content: string;
	children?: ReactNode;
	className?: string;
	variant?: "default" | "secondary" | "outline" | "ghost";
	size?: "default" | "sm" | "lg" | "icon";
}

export function CopyButton({ 
	content, 
	children,
	className,
	variant = "secondary",
	size = "default"
}: CopyButtonProps) {
	const [status, setStatus] = useState<"idle" | "copied">("idle");

	async function copy() {
		try {
			await navigator.clipboard.writeText(content);
			setStatus("copied");
		} catch (error) {
			console.error(error);
		} finally {
			setTimeout(() => setStatus("idle"), 2000);
		}
	}

	return (
		<Button 
			variant={variant} 
			size={size}
			onClick={copy}
			className={cn("gap-2 transition-all duration-200", className)}
		>
			{status === "copied" ? (
				<Check className="h-4 w-4 text-emerald-500" />
			) : (
				<Copy className="h-4 w-4" />
			)}
			{children}
		</Button>
	);
}

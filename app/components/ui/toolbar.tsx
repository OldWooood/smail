import type * as React from "react";

import { cn } from "~/lib/utils";

export interface ToolbarProps {
	icon: React.ReactNode;
	title: React.ReactNode;
	right?: React.ReactNode;
	className?: string;
}

export function Toolbar({ icon, title, right, className }: ToolbarProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 border-y-2 border-foreground/10 bg-background/80 px-4 py-3 shadow-[0_6px_0_0_hsl(var(--foreground)/0.08)] backdrop-blur-sm transition-all duration-300 ease-out",
				className,
			)}
		>
			<div className="text-foreground/80">{icon}</div>
			<div className="font-semibold">{title}</div>
			<div className="flex-1" />
			{right}
		</div>
	);
}

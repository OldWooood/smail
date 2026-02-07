import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border border-foreground/20 bg-transparent px-6 py-3 text-[11px] font-black uppercase tracking-[0.24em] transition-[transform,box-shadow,color,background-color,border-color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"text-foreground border-foreground/50 shadow-[6px_6px_0_0_hsl(var(--foreground)/0.2)] hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_hsl(var(--foreground)/0.25)]",
				destructive:
					"text-destructive border-destructive shadow-[6px_6px_0_0_hsl(var(--destructive)/0.25)] hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_hsl(var(--destructive)/0.3)]",
				outline: "text-foreground border-foreground/30 hover:border-foreground",
				secondary:
					"text-accent border-accent shadow-[6px_6px_0_0_hsl(var(--accent)/0.25)] hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_hsl(var(--accent)/0.3)]",
				ghost: "border-transparent text-foreground/80 hover:text-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-11",
				sm: "h-9 px-4 text-[10px] tracking-[0.18em]",
				lg: "h-12 px-8",
				icon: "h-11 w-11 px-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

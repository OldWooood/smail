import { Clock, User } from "lucide-react";
import { cn } from "~/lib/utils";

interface EmailReaderProps {
	id: string;
	subject: string | null;
	sender: string;
	createdAt: string;
	noSubject: string;
	className?: string;
}

export function EmailReader({
	id,
	subject,
	sender,
	createdAt,
	noSubject,
	className,
}: EmailReaderProps) {
	const senderLabel = sender || subject || "?";
	const senderInitial = [...senderLabel.trim()][0]?.toUpperCase() || "@";
	const bodySrc = `/api/emails/${id}/body`;

	return (
		<div
			className={cn(
				"panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl",
				className,
			)}
		>
			<div className="shrink-0 border-b border-border px-5 py-5 sm:px-6">
				<div className="flex items-start gap-3">
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold uppercase text-primary ring-1 ring-primary/20">
						{senderInitial}
					</div>
					<div className="min-w-0 flex-1">
						<h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
							{subject || noSubject}
						</h2>
						<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
							{sender && (
								<span className="flex min-w-0 items-center gap-1.5">
									<User className="h-3.5 w-3.5 shrink-0" />
									<span
										translate="no"
										className={cn(
											"truncate text-foreground/80",
											sender.includes("@") ? "font-mono" : "font-medium",
										)}
									>
										{sender}
									</span>
								</span>
							)}
							<span className="flex items-center gap-1.5">
								<Clock className="h-3.5 w-3.5" />
								<span className="font-mono">{createdAt}</span>
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 bg-[#fdfdfc]">
				<iframe
					key={bodySrc}
					title={subject || "Email Content"}
					src={bodySrc}
					className="h-full w-full bg-[#fdfdfc]"
					loading="eager"
					referrerPolicy="no-referrer"
					sandbox="allow-popups allow-popups-to-escape-sandbox"
				/>
			</div>
		</div>
	);
}

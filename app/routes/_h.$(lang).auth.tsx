import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { LockKeyholeIcon } from "lucide-react";
import { sessionWrapper } from "~/.server/session";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getLocaleData } from "~/locales/locale";

export async function loader({ params }: LoaderFunctionArgs) {
	const lang = params.lang || "en";
	const locale = await getLocaleData(lang);
	return {
		locale,
	};
}

export async function action({ request, context }: ActionFunctionArgs) {
	const password = (await request.formData()).get("password") as string;
	if (password === context.cloudflare.env.PASSWORD) {
		const { getSession, commitSession } = sessionWrapper(
			context.cloudflare.env,
		);
		const session = await getSession(request.headers.get("Cookie"));
		session.set("password", password);
		return redirect("/", {
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		});
	}
	return {
		error: true,
	};
}

export default function Auth() {
	const { locale } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();

	const navigation = useNavigation();

	return (
		<div className="flex flex-1 items-start justify-center px-6 pt-10">
			<Form method="POST" className="w-full max-w-md">
				<Card>
					<CardHeader className="gap-2 py-5">
						<div className="flex items-center gap-3">
							<div className="flex size-12 items-center justify-center border-2 border-foreground/10 bg-background shadow-[6px_6px_0_0_hsl(var(--foreground)/0.08)]">
								<LockKeyholeIcon
									strokeWidth="1.5px"
									className="size-5 text-foreground"
								/>
							</div>
							<CardTitle className="font-display text-xl uppercase tracking-[0.12em]">
								{locale.auth.title}
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">{locale.auth.title}</Label>
							<Input id="password" name="password" type="password" required />
							{actionData?.error && (
								<div className="text-destructive text-xs">
									{locale.auth.msg}
								</div>
							)}
						</div>
						<Button disabled={navigation.state === "submitting"}>
							{locale.auth.submit}
						</Button>
					</CardContent>
				</Card>
			</Form>
		</div>
	);
}

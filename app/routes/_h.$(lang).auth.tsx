import { Loader2, Lock } from "lucide-react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
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
		session.set("authed", true);
		session.unset("password");
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
		<div className="flex flex-1 items-center justify-center px-4 sm:px-6 py-12">
			<Form method="POST" className="w-full max-w-md">
				<Card>
					<CardHeader className="space-y-1">
						<div className="flex items-center justify-center mb-4">
							<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<Lock className="h-8 w-8" />
							</div>
						</div>
						<CardTitle className="text-xl font-semibold text-center">
							{locale.auth.title}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="password">{locale.auth.password_label}</Label>
							<Input
								id="password"
								name="password"
								type="password"
								placeholder={locale.auth.password_placeholder}
								required
							/>
						</div>
						{actionData?.error && (
							<p className="text-sm text-destructive text-center">
								{locale.auth.msg}
							</p>
						)}
						<Button
							type="submit"
							disabled={navigation.state === "submitting"}
							className="w-full"
						>
							{navigation.state === "submitting" ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									{locale.auth.verifying}
								</>
							) : (
								locale.auth.submit
							)}
						</Button>
					</CardContent>
				</Card>
			</Form>
		</div>
	);
}

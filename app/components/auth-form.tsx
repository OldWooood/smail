import { Turnstile } from "@marsidev/react-turnstile";
import { Form, type useNavigation } from "@remix-run/react";
import { LoaderIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Locale } from "~/locales/locale";

const DEFAULT_TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

interface AuthFormProps {
    turnstileSiteKey: string | undefined;
    lang: string;
    locale: Locale;
    navigation: ReturnType<typeof useNavigation>;
    setToken: (token: string) => void;
    token: string;
}

export function AuthForm({
    turnstileSiteKey,
    lang,
    locale,
    navigation,
    setToken,
    token,
}: AuthFormProps) {
    return (
        <Form method="POST" className="flex flex-col gap-4">
            <Turnstile
                siteKey={turnstileSiteKey || DEFAULT_TEST_TURNSTILE_SITE_KEY}
                options={{
                    theme: "light",
                    refreshExpired: "auto",
                    language: lang,
                }}
                onSuccess={setToken}
                className="h-[65px] w-[300px] items-center bg-secondary"
            />
            <Button disabled={navigation.state === "submitting" || token === ""}>
                {navigation.state === "submitting" ? (
                    <LoaderIcon className="animate-spin" />
                ) : (
                    locale?.button
                )}
            </Button>
        </Form>
    );
}

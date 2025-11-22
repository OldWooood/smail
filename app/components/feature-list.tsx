import {
    CircleDollarSignIcon,
    CodeIcon,
    ShieldIcon,
    SwatchBookIcon,
} from "lucide-react";
import type { Locale } from "~/locales/locale";

interface FeatureListProps {
    locale: Locale;
}

const featureIcons = [
    <CodeIcon key="code" className="text-blue-500" />,
    <CircleDollarSignIcon key="dollar" className="text-blue-500" />,
    <SwatchBookIcon key="swatch" className="text-blue-500" />,
    <ShieldIcon key="shield" className="text-blue-500" />,
];

export function FeatureList({ locale }: FeatureListProps) {
    return (
        <div className="flex flex-col flex-1 max-w-md w-full min-h-0 p-2 pt-8 gap-2">
            {locale?.features.map((feature, idx) => (
                <div key={`feature-${idx}`} className="flex gap-4 p-2">
                    {featureIcons[idx]}
                    <div className="flex flex-1 flex-col gap-4">
                        <span className="font-bold">{feature.title}</span>
                        <span className="text-sm text-muted-foreground">
                            {feature.description}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

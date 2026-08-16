import type { Metadata } from "next";
import { GearIcon, ShieldWarningIcon } from "@phosphor-icons/react/dist/ssr";

import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { normalizeSettingsRows, type SiteSettingDto } from "./settings-dto";
import { SettingRow } from "./setting-row";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: {
    index: false,
    follow: false,
  },
};

const LABELS: Readonly<Record<string, string>> = {
  "features.codex_public": "Public Codex",
  "features.reactions": "Reactions",
  "site.description": "Description",
  "site.name": "Site name",
  "site.navigation": "Navigation",
  "site.registration_open": "Open registration",
  "theme.initial": "Initial theme",
};

const SECTIONS = [
  {
    id: "general",
    keys: ["site.name", "site.description", "site.navigation", "site.registration_open"],
    title: "General",
  },
  { id: "appearance", keys: ["theme.initial"], title: "Appearance" },
  { id: "features", keys: ["features.reactions", "features.codex_public"], title: "Features" },
] as const;

function humanizeKey(key: string) {
  return key
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/^\w/, (first) => first.toUpperCase());
}

function renderSection(section: (typeof SECTIONS)[number], settings: SiteSettingDto[]) {
  const sectionSettings = section.keys
    .map((key) => settings.find((setting) => setting.key === key))
    .filter((setting): setting is SiteSettingDto => Boolean(setting));

  if (sectionSettings.length === 0) return null;

  return (
    <section key={section.id} aria-labelledby={`settings-${section.id}`} className="mt-8">
      <h2 id={`settings-${section.id}`} className="text-fg text-lg font-semibold">
        {section.title}
      </h2>
      <div className="border-border border-t">
        {sectionSettings.map((setting) => (
          <SettingRow
            description={setting.description}
            key={setting.key}
            label={LABELS[setting.key] ?? humanizeKey(setting.key)}
            maxValue={setting.maxValue}
            minValue={setting.minValue}
            settingKey={setting.key}
            value={setting.value}
            valueType={setting.valueType}
          />
        ))}
      </div>
    </section>
  );
}

export default async function CouncilSettingsPage() {
  const access = await can("admin.manage_settings");

  if (!access.allowed) {
    if (access.reason === "verification_failed") {
      throw new Error("Site settings authorization could not be verified");
    }

    return (
      <div className="mx-auto w-full max-w-4xl">
        <div>
          <h1 className="text-fg text-2xl font-semibold">Settings</h1>
          <p className="text-fg-muted mt-1 text-sm">Community-wide configuration.</p>
        </div>

        <div role="alert" className="border-error/30 bg-error/10 mt-6 rounded-md border p-5">
          <div className="flex items-start gap-3">
            <ShieldWarningIcon aria-hidden="true" className="text-error mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-fg text-sm">You do not have permission to manage site settings.</p>
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_site_settings");

  if (error) {
    throw new Error("Site settings could not be loaded");
  }

  const settings = normalizeSettingsRows(data);

  if (settings.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div>
          <h1 className="text-fg text-2xl font-semibold">Settings</h1>
          <p className="text-fg-muted mt-1 text-sm">Community-wide configuration.</p>
        </div>

        <EmptyState
          icon={<GearIcon className="h-8 w-8" />}
          title="No settings yet"
          description="There is nothing to configure right now. Settings are seeded with the schema."
        />
      </div>
    );
  }

  const knownKeys = new Set<string>(SECTIONS.flatMap((section) => section.keys));
  const orphanSettings = settings.filter((setting) => !knownKeys.has(setting.key));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div>
        <h1 className="text-fg text-2xl font-semibold">Settings</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Community-wide configuration. Each change is compared against what you see and written to
          the audit log with its previous value.
        </p>
      </div>

      {SECTIONS.map((section) => renderSection(section, settings))}

      {orphanSettings.length > 0 ? (
        <section aria-labelledby="settings-other" className="mt-8">
          <h2 id="settings-other" className="text-fg text-lg font-semibold">
            Other
          </h2>
          <div className="border-border border-t">
            {orphanSettings.map((setting) => (
              <SettingRow
                description={setting.description}
                key={setting.key}
                label={LABELS[setting.key] ?? humanizeKey(setting.key)}
                maxValue={setting.maxValue}
                minValue={setting.minValue}
                settingKey={setting.key}
                value={setting.value}
                valueType={setting.valueType}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

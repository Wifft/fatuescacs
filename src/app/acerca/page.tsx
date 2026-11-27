import type { Metadata } from "next";
import licenses from "@/generated/licenses.json";
import { messages } from "@/messages/es";

export const metadata: Metadata = { title: `${messages.about.title} · ${messages.app.title}` };

const REPO = "https://github.com/Wifft/fatuescacs";

interface Dep {
  name: string;
  version: string;
  license: string;
  homepage: string | null;
}

export default function AboutPage() {
  const t = messages.about;
  const deps = licenses as Dep[];
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-2 text-muted">{t.intro}</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t.privacyTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {t.privacy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t.licenseTitle}</h2>
        <p className="mt-2">{t.license}</p>
        <p className="mt-2">
          <a href={REPO} className="underline" rel="noopener">
            {t.source}: {REPO.replace("https://", "")}
          </a>{" "}
          ·{" "}
          <a href={`${REPO}/blob/main/LICENSE`} className="underline" rel="noopener">
            GPL-3.0
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t.creditsTitle}</h2>
        <dl className="mt-2 grid gap-2">
          {t.credits.map(([name, url, text]) => (
            <div key={name}>
              <dt className="font-semibold">
                <a href={url} className="underline" rel="noopener">
                  {name}
                </a>
              </dt>
              <dd className="text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8" data-testid="deps">
        <h2 className="text-xl font-semibold">{t.depsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.depsIntro(deps.length)}</p>
        <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-soft text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t.depName}</th>
                <th className="px-3 py-2 font-medium">{t.depVersion}</th>
                <th className="px-3 py-2 font-medium">{t.depLicense}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {deps.map((d) => (
                <tr key={d.name}>
                  <td className="px-3 py-1.5">
                    {d.homepage ? (
                      <a href={d.homepage} className="underline" rel="noopener">
                        {d.name}
                      </a>
                    ) : (
                      d.name
                    )}
                  </td>
                  <td className="px-3 py-1.5">{d.version}</td>
                  <td className="px-3 py-1.5">{d.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

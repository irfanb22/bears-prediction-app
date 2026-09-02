import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '../lib/siteContact';

interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}

function LegalPageLayout({ eyebrow, title, intro, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <div className="bg-gradient-to-r from-bears-navy to-slate-800 px-8 py-8 text-white sm:px-10">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-4 text-sm text-slate-300">Last updated: {LEGAL_LAST_UPDATED}</p>
          </div>

          <div className="px-8 py-8 sm:px-10">
            <p className="text-lg leading-8 text-slate-700">{intro}</p>
            <div className="mt-8 space-y-8">{children}</div>
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-bears-orange px-5 py-3 text-sm font-bold text-white transition hover:bg-bears-orange/90"
          >
            Return to Site
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-black tracking-tight text-slate-900">{heading}</h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-slate-700">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function ContactLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="font-semibold text-bears-orange underline underline-offset-2 hover:text-bears-orange/80"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Privacy Policy"
      intro="Bears Prediction Tracker is a free site for making and tracking predictions about the Chicago Bears season. This policy explains what we collect, why we collect it, and what control you have over it."
    >
      <Section heading="Information you give us">
        <Bullets
          items={[
            <>
              <strong>Your email address.</strong> Required to create an account, sign in, and receive
              account-related messages.
            </>,
            <>
              <strong>Your display name.</strong> Optional to choose, but it is what appears next to your
              results. See the section on what is public below.
            </>,
            <>
              <strong>Your predictions and picks.</strong> The answers you submit, when you submitted them,
              and how they scored once the outcome is known.
            </>,
          ]}
        />
      </Section>

      <Section heading="Information we receive when you sign in with Google">
        <p>
          If you choose to sign in with Google, Google sends us your email address and basic profile
          information, such as your name and profile picture. We use this only to create and identify your
          account.
        </p>
        <p>
          We never see or receive your Google password. You can review and revoke this access at any time
          from your Google account&apos;s security settings.
        </p>
      </Section>

      <Section heading="Information we collect automatically">
        <Bullets
          items={[
            <>
              <strong>Product analytics.</strong> We use PostHog to record which pages you visit and which
              actions you take, so we can understand how the site is used. This includes session recordings,
              which replay how a visit moved through the site. Text you type into form fields is masked and
              is not captured in those recordings.
            </>,
            <>
              <strong>Email engagement.</strong> When we send you an email, we record whether it was
              delivered, opened, or clicked, and whether it bounced or was marked as spam. This helps us
              avoid sending mail that is unwanted or undeliverable.
            </>,
            <>
              <strong>Basic technical information.</strong> Standard details such as browser type, device
              type, and approximate location derived from your IP address.
            </>,
          ]}
        />
      </Section>

      <Section heading="What is visible to other people">
        <p>
          The leaderboard is a public part of this site. Your <strong>display name</strong>, your accuracy,
          and your scored results appear there and can be seen by anyone who visits.
        </p>
        <p>
          Your email address is never shown on the leaderboard or anywhere else on the site. If you would
          rather not be identifiable, choose a display name that is not your real name.
        </p>
      </Section>

      <Section heading="How we use your information">
        <Bullets
          items={[
            'To create your account and keep you signed in.',
            'To record your predictions, score them, and build leaderboards.',
            'To send you emails about the season, your results, and reminders about upcoming deadlines.',
            'To understand how the site is used and to improve it.',
            'To investigate abuse, fix problems, and keep the site working.',
          ]}
        />
        <p>We do not sell your personal information, and we do not share it for advertising.</p>
      </Section>

      <Section heading="Services that process data for us">
        <p>We rely on a small number of providers to operate the site. Each processes data on our behalf:</p>
        <Bullets
          items={[
            <><strong>Supabase</strong> — hosts the database and handles accounts and sign-in.</>,
            <><strong>Netlify</strong> — hosts and serves the website itself.</>,
            <><strong>PostHog</strong> — product analytics and session recordings.</>,
            <><strong>Amazon Web Services (SES)</strong> — sends our email and reports delivery results.</>,
            <><strong>Google</strong> — only if you choose to sign in with Google.</>,
          ]}
        />
      </Section>

      <Section heading="Your choices">
        <Bullets
          items={[
            <>
              <strong>Marketing email.</strong> Every marketing email includes an unsubscribe link. After you
              confirm the request, it takes effect immediately. You will still receive essential account
              messages, such as password resets.
            </>,
            <>
              <strong>Your display name.</strong> You can change it at any time from the site.
            </>,
            <>
              <strong>Access or deletion.</strong> Email <ContactLink /> and we will provide a copy of your
              data or delete your account. Deleting your account removes your predictions and your entries
              from the leaderboard.
            </>,
          ]}
        />
      </Section>

      <Section heading="How long we keep it">
        <p>
          We keep your account and prediction history for as long as your account exists, since past seasons
          are part of what the site shows you. If you ask us to delete your account, we remove your personal
          information promptly, other than anything we are required to keep.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          This site is not directed to children under 13, and we do not knowingly collect information from
          them. If you believe a child has created an account, contact <ContactLink /> and we will remove it.
        </p>
      </Section>

      <Section heading="Changes to this policy">
        <p>
          If we change this policy in a way that meaningfully affects you, we will update the date at the top
          of this page and, where appropriate, tell you by email.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy or your data can go to <ContactLink />.
        </p>
      </Section>
    </LegalPageLayout>
  );
}

export function TermsOfService() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms cover your use of Bears Prediction Tracker. By creating an account or using the site, you agree to them."
    >
      <Section heading="Not affiliated with the Chicago Bears or the NFL">
        <p>
          This is an independent fan project. It is not affiliated with, endorsed by, or sponsored by the
          Chicago Bears, the National Football League, or any of their affiliates. All team names, logos, and
          trademarks belong to their respective owners and are referred to here for identification only.
        </p>
      </Section>

      <Section heading="What this site is">
        <p>
          Bears Prediction Tracker is a free site for entertainment. You answer questions about the upcoming
          season, and we score them as outcomes become known.
        </p>
        <p>
          <strong>This is not gambling and there is nothing to win.</strong> No money changes hands, no
          wagers are accepted, and no prizes are awarded. Nothing on this site is betting advice.
        </p>
      </Section>

      <Section heading="Your account">
        <Bullets
          items={[
            'Use an email address you control, and keep your sign-in details to yourself.',
            'One account per person. Extra accounts created to influence the leaderboard may be removed.',
            'You are responsible for activity that happens under your account.',
            'You must be at least 13 years old to create an account.',
          ]}
        />
      </Section>

      <Section heading="Acceptable use">
        <p>Please do not:</p>
        <Bullets
          items={[
            'Choose a display name that is offensive, impersonates someone else, or is deliberately misleading.',
            'Interfere with the site, try to break it, or attempt to reach data that is not yours.',
            'Scrape or bulk-collect content from the site through automated means.',
            'Use the site for anything unlawful.',
          ]}
        />
        <p>
          Display names appear publicly on the leaderboard. We may change or remove a display name that
          breaks these rules.
        </p>
      </Section>

      <Section heading="Scoring and results">
        <p>
          We decide when a question is resolved and how it is scored, using publicly reported results.
          Predictions lock at the deadline shown on each question and cannot be changed afterward.
        </p>
        <p>
          We correct scoring mistakes when we find them, which can change leaderboard standings after the
          fact. Where a question is ambiguous, our reading of it is final.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          The site is provided as is. We do not promise it will always be available, error-free, or that
          scores and results will always be accurate. We may change, pause, or discontinue any part of it,
          including this season&apos;s questions, at any time.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for any indirect or consequential loss
          arising from your use of this site. Because the site is free and awards nothing of value, our total
          liability to you is limited accordingly.
        </p>
      </Section>

      <Section heading="Ending your access">
        <p>
          You can stop using the site or ask us to delete your account at any time by emailing{' '}
          <ContactLink />. We may suspend or remove an account that breaks these terms.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          We may update these terms. When we do, we will change the date at the top of this page. Continuing
          to use the site after a change means you accept the updated terms.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms can go to <ContactLink />.
        </p>
      </Section>
    </LegalPageLayout>
  );
}

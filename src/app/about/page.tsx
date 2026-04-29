import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Quote, Flag, Timer } from "lucide-react";
import { DEFAULT_TEAM_PROFILES, TeamCarouselUI, type Team, type TeamResult } from "@/components/sections/TeamProfileCarousel";
import { createServiceClient } from "@/lib/supabase/server";
import { CLAW_CONSTRUCTION_LOGO_URL, CLAW_RACING_PHOTO_URL, normalizeTeamLogoUrl, SCAFF_LOGO_URL } from "@/lib/teamLogos";

// Always render fresh — admin team-profile changes must show up instantly.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Us",
  description: "Decades of karting and motorsport experience. Sydney's trusted kart specialists.",
  alternates: {
    canonical: "/about",
  },
};

export default async function AboutPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dsracingkarts.com.au";
  // Fetch team profiles from DB; fall back to empty (carousel uses hardcoded data)
  let dbTeams: Team[] = [];
  try {
    const supabase = createServiceClient();
    const [{ data: teamData }, { data: resultsData }] = await Promise.all([
      supabase
        .from("team_profiles")
        .select("id, kart_number, team_name, accent_color, accent_rgb, logo_url, tagline, website_url")
        .eq("is_active", true)
        .order("sort_order")
        .order("team_name"),
      supabase
        .from("team_results")
        .select("id, team_profile_id, event_date, event_name, track, class, position, best_lap_time, top_speed_kmh, notes")
        .order("event_date", { ascending: false }),
    ]);
    if (teamData && teamData.length > 0) {
      const resultsByTeam = (resultsData ?? []).reduce<Record<string, TeamResult[]>>((acc, r) => {
        (acc[r.team_profile_id] ??= []).push(r as TeamResult);
        return acc;
      }, {});
      dbTeams = teamData.map((t) => ({
        number: t.kart_number,
        name: t.team_name,
        accent: t.accent_color,
        accentRgb: t.accent_rgb,
        logo: normalizeTeamLogoUrl(t.logo_url, t.team_name),
        secondaryLogo: t.team_name.toLowerCase().includes("claw racing") ? CLAW_CONSTRUCTION_LOGO_URL : undefined,
        tagline: t.tagline || undefined,
        website: t.website_url || undefined,
        websiteLabel: t.team_name.toLowerCase().includes("claw racing") ? "See Our Other Work" : undefined,
        results: resultsByTeam[t.id] ?? [],
      })).map((team) => {
          if (team.name.toLowerCase() === "scaff it up") {
            return { ...team, logo: SCAFF_LOGO_URL };
          }
          if (team.name.toLowerCase().includes("claw racing")) {
            return {
              ...team,
              logo: CLAW_RACING_PHOTO_URL,
              secondaryLogo: CLAW_CONSTRUCTION_LOGO_URL,
              website: "https://clawconstruction.com.au/",
              websiteLabel: "See Our Other Work",
            };
          }
          return team;
        });
      const seenNumbers = new Set(
        dbTeams
          .map((team) => team.number?.trim())
          .filter((value): value is string => Boolean(value))
      );
      const seenNames = new Set(
        dbTeams
          .map((team) => team.name.trim().toLowerCase())
          .filter(Boolean)
      );
      for (const fallbackTeam of DEFAULT_TEAM_PROFILES) {
        const fallbackNumber = fallbackTeam.number?.trim();
        const fallbackName = fallbackTeam.name.trim().toLowerCase();
        const alreadyPresent =
          (fallbackNumber && seenNumbers.has(fallbackNumber)) ||
          seenNames.has(fallbackName);

        if (!alreadyPresent) {
          dbTeams.push(fallbackTeam);
          if (fallbackNumber) seenNumbers.add(fallbackNumber);
          seenNames.add(fallbackName);
        }
      }
    }
  } catch {
    // use hardcoded fallback
  }
  const displayTeams = dbTeams.length > 0 ? dbTeams : DEFAULT_TEAM_PROFILES;
  return (
    <>
      {/* Hero */}
      <section className="relative bg-racing-black carbon-fiber py-20 md:py-28">
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-[1px] w-8 bg-racing-red" />
            <span className="font-heading text-xs tracking-[0.4em] text-racing-red uppercase">About Us</span>
            <span className="h-[1px] w-8 bg-racing-red" />
          </div>
          <h1 className="font-heading text-4xl md:text-6xl uppercase tracking-[0.1em] text-white mb-6">
            DS Racing <span className="text-racing-red">Karts</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
            With decades of hands-on karting and motorsport experience,
            DS Racing Karts is Sydney&apos;s trusted name in kart sales, servicing, and race preparation.
          </p>
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* ── Section 1: The Founder — Dion Scott ── */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="flex items-center gap-3 mb-12">
          <span className="h-[1px] w-8 bg-racing-red" />
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
            The <span className="text-racing-red">Founder</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-[340px_1fr] gap-10 md:gap-14 items-start">
          {/* ── Profile card with image placeholder ── */}
          <div className="relative mx-auto md:mx-0 w-full max-w-[340px]">
            {/* Image area */}
            <div className="relative aspect-[3/4] bg-racing-dark border border-white/10 overflow-hidden mb-5">
              <Image
                src="/images/history/Dion.jpeg"
                alt="Dion Scott — Founder of DS Racing Karts"
                fill
                className="object-cover"
                sizes="340px"
              />
              {/* Red corner accent */}
              <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[60px] border-b-racing-red border-l-[60px] border-l-transparent" />
            </div>
            {/* Name & title */}
            <div className="text-center md:text-left">
              <h3 className="font-heading text-xl uppercase tracking-[0.12em] text-white">
                Dion Scott
              </h3>
              <p className="text-xs uppercase tracking-[0.2em] text-racing-red font-heading mt-1">
                Founder &amp; Lead Engineer
              </p>
              <p className="text-xs text-white/40 uppercase tracking-[0.15em] mt-2">
                Racing since 1989
              </p>
              <p className="text-xs text-white/30 uppercase tracking-[0.12em] mt-1">
                V8 &amp; Exotics Driver Coach — Fastrack Experiences
              </p>
            </div>
          </div>

          {/* ── Quote / Story ── */}
          <div className="relative">
            {/* Large decorative opening quote mark — offset from the border line */}
            <Quote size={40} className="text-racing-red/20 absolute -top-6 left-8 rotate-180" strokeWidth={1.5} />

            <blockquote className="relative pl-8 border-l-[3px] border-l-racing-red/30">
              <div className="space-y-4 text-white/70 leading-relaxed text-[15px] pt-6">
                <p className="text-lg font-medium text-white">
                  Karting has been our passion since 1989 in Clubman Twins &mdash; winning many events
                  and breaking records that have never been broken to this very day.
                </p>
                <p>
                  Choosing what brand of kart parts can be confusing, which is why, with our experience,
                  we can guide you to the right product for your budget and requirements.
                </p>
                <p>
                  In 2001 I had my first experience with endurance karting, with a group of friends.
                  We hired an enduro kart through Prokart for one of their 12-hour races and quickly
                  learned that reliability was the key to winning.
                </p>
                <p>
                  After that first experience, we quickly decided to build our own team and have a go
                  at running a series.
                </p>
                <p>
                  Over the years I have designed, tested and sold karts to numerous teams, assisting
                  with setup and driver training in both sprint karting and endurance karting.
                </p>
                <p>
                  Around 2009 I decided to have a go at building my own chassis for enduro karting
                  &mdash; so I purchased some chromoly, borrowed a tube bender and drew up several designs.
                </p>
                <p>
                  Over the years, my chassis has been proven &mdash; winning multiple championships,
                  24-hour races and pole positions in both wet and dry conditions.
                </p>
                <p>
                  Up until now the DSR Predator has only been available to the Horsepower and Bell Pipes
                  teams. As these teams are no longer competing and I no longer want to race go karts
                  full time, I have committed myself to helping other teams by selling spare parts at
                  various rounds and chassis by custom order.
                </p>
                <p>
                  We are also authorised dealers for DPE, KKC, IKD, NR Racing and many more &mdash;
                  so if we don&apos;t have it in stock, we can get it within 24 hours if it&apos;s
                  in the country.
                </p>
                <p>
                  Outside of karting, I&apos;m also a V8 &amp; Exotics driver coach for Fastrack
                  Experiences &mdash; so motorsport really is a full-time passion.
                </p>
              </div>

              {/* Closing quote mark */}
              <div className="flex justify-end mt-2 pr-2">
                <Quote size={40} className="text-racing-red/20" strokeWidth={1.5} />
              </div>

              <footer className="mt-4 flex items-center gap-3">
                <span className="h-[2px] w-6 bg-racing-red" />
                <cite className="not-italic font-heading text-xs uppercase tracking-[0.2em] text-white/50">
                  Dion Scott, Founder of DS Racing Karts
                </cite>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4"><div className="racing-line" /></div>

      {/* ── Section 2: Our Racing Teams ── */}
      <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center gap-3 mb-4">
          <span className="h-[1px] w-8 bg-racing-red" />
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
            Our Racing <span className="text-racing-red">Teams</span>
          </h2>
        </div>
        <p className="text-white/60 max-w-2xl mb-2 leading-relaxed">
          DS Racing Karts is proud to support some of the most competitive teams
          in Australian endurance karting. From seasoned veterans to rising contenders,
          our teams represent the best of grassroots motorsport.
        </p>

        {/* Mini team number strip */}
        <div className="flex flex-wrap items-center gap-3 mt-6 mb-2">
          {Array.from(
            new Set(
              displayTeams
                .map((team) => team.number?.trim())
                .filter((num): num is string => Boolean(num))
            )
          ).map((num) => (
            <span
              key={num}
              className="font-heading text-xs uppercase tracking-[0.15em] text-white/30 border border-white/10 px-2 py-1"
            >
              #{num}
            </span>
          ))}
        </div>

        <TeamCarouselUI teams={displayTeams} />
      </section>

      <div className="chequered-stripe" />

      {/* ── Section 3: Results ── */}
      <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-[1px] w-8 bg-racing-red" />
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
            Endurance Karting <span className="text-racing-red">Results</span>
          </h2>
        </div>
        <p className="text-white/50 text-sm mb-10 ml-[44px]">DSR Predator Chassis · Series & Championship Finishes</p>

        {/* Championship results timeline */}
        <div className="grid md:grid-cols-[1fr_1px_1fr] gap-0 mb-16">
          {/* Left column */}
          <div className="space-y-0">
            {[
              { year: "2009", result: "2nd in Series" },
              { year: "2010", result: "2nd in Series" },
              { year: "2011", result: "1st Victoria · 3rd ACT · 3rd NSW — 4th National · 2nd NSW" },
              { year: "2012", result: "2nd in Series — Horsepower Racing (#777)" },
              { year: "2013", result: "2nd in Series — Bell Pipes (#23)  ·  3rd in Series — Horsepower Racing (#777)" },
              { year: "2014", result: "1st in Series — Bell Pipes (#23)" },
              { year: "2015", result: "1st in Series — Horsepower Racing (#777)" },
              { year: "2016", result: "Did not contest full series — a number of podium finishes" },
              { year: "2017", result: "Did not contest full series — a number of podium finishes" },
            ].map((item) => (
              <div key={item.year} className="group flex gap-0 items-stretch">
                <div className="flex flex-col items-center mr-4">
                  <div className="w-[3px] bg-racing-red/20 group-first:rounded-t flex-1 group-first:mt-2" />
                  <div className="w-2.5 h-2.5 rounded-full bg-racing-red shrink-0 my-1" />
                  <div className="w-[3px] bg-racing-red/20 flex-1 group-last:mb-2" />
                </div>
                <div className="py-3 pr-4">
                  <span className="font-digital text-racing-red text-sm block mb-0.5">{item.year}</span>
                  <span className="text-sm text-white/70 leading-snug">{item.result}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Vertical divider */}
          <div className="hidden md:block bg-racing-red/10 mx-6" />

          {/* Right column */}
          <div className="space-y-0 mt-8 md:mt-0">
            {[
              { year: "2018", result: "Did not contest full series — a number of podium finishes" },
              { year: "2019", result: "Did not contest full series — a number of podium finishes" },
              { year: "2020", result: "Did not contest full series — a number of podium finishes" },
              { year: "2021", result: "1st in Series — Horsepower Racing (#777) Sportsman · 1st in Series HP Max" },
              { year: "2022", result: "2nd in Series — HP Max" },
              { year: "2023", result: "1st Maxx — Kart #333 CGR · 2nd Sportsman — Claw Racing (#555) · 1st — Polaris Marine (#23)" },
              { year: "2024", result: "2nd & 3rd A Grade — Karts #333 ARK & #49 DSR · 2nd B Grade — Kart #555 Claw Racing · Pole Position 24hr — Kart #71 EDTWARP · 1st C Grade 24hr — Kart #12 Unbeatables" },
              { year: "2025", result: "Australian Championship Sportsman — Venom Racing (#272) · SportsmanClass Club Champions SEK" },
            ].map((item) => (
              <div key={item.year} className="group flex gap-0 items-stretch">
                <div className="flex flex-col items-center mr-4">
                  <div className="w-[3px] bg-racing-red/20 group-first:rounded-t flex-1 group-first:mt-2" />
                  <div className="w-2.5 h-2.5 rounded-full bg-racing-red shrink-0 my-1" />
                  <div className="w-[3px] bg-racing-red/20 flex-1 group-last:mb-2" />
                </div>
                <div className="py-3 pr-4">
                  <span className="font-digital text-racing-red text-sm block mb-0.5">{item.year}</span>
                  <span className="text-sm text-white/70 leading-snug">{item.result}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 24hr race distances */}
        <div className="border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
            <Timer size={16} className="text-racing-red shrink-0" />
            <h3 className="font-heading text-sm uppercase tracking-[0.2em] text-white">24hr Race Distances</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-3 text-left font-heading text-xs uppercase tracking-[0.15em] text-racing-red">Year</th>
                  <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-[0.15em] text-racing-red">Venue</th>
                  <th className="px-4 py-3 text-right font-heading text-xs uppercase tracking-[0.15em] text-racing-red">Distance</th>
                  <th className="px-6 py-3 text-right font-heading text-xs uppercase tracking-[0.15em] text-racing-red">Laps</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { year: "2007", venue: "Wollongong", km: "1,411 km", laps: "2,613" },
                  { year: "2008", venue: "Eastern Creek", km: "1,573 km", laps: "1,536" },
                  { year: "2009", venue: "Ipswich", km: "1,535 km", laps: "1,413" },
                  { year: "2010", venue: "Ipswich", km: "1,532 km", laps: "1,411" },
                  { year: "2011", venue: "Ipswich", km: "1,402 km", laps: "1,291" },
                  { year: "2012", venue: "Tamworth", km: "1,543 km", laps: "2,026" },
                  { year: "2014", venue: "Eastern Creek", km: "1,724 km ★", laps: "1,684" },
                  { year: "2015", venue: "Eastern Creek", km: "1,507 km", laps: "1,472" },
                  { year: "2019", venue: "Eastern Creek", km: "1,065 km", laps: "1,040" },
                  { year: "2024", venue: "Eastern Creek", km: "1,662 km", laps: "1,623" },
                ].map((row, i) => (
                  <tr key={row.year} className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                    <td className="px-6 py-3 font-digital text-racing-red">{row.year}</td>
                    <td className="px-4 py-3 text-white/70">{row.venue}</td>
                    <td className="px-4 py-3 text-right text-white/70 tabular-nums">{row.km}</td>
                    <td className="px-6 py-3 text-right text-white/50 tabular-nums">{row.laps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-xs text-white/30 border-t border-white/10">★ Track record at time of race</p>
        </div>
      </section>

      {/* Trophies showcase */}
      <section className="bg-racing-black py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative aspect-[16/9] overflow-hidden border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
            <Image
              src="/images/history/Trophies.webp"
              alt="DS Racing Karts trophy collection — decades of wins"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-racing-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
              <span className="font-heading text-xs tracking-[0.3em] text-racing-red uppercase">Decades of Winning</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-heading text-2xl uppercase tracking-[0.1em] text-white mb-4">
          Ready to <span className="text-racing-red">Race?</span>
        </h2>
        <p className="text-white/60 mb-8">
          Whether you need parts, servicing, or expert advice — we&apos;re here to help you get on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/shop" className="btn-primary px-8">Shop Parts</Link>
          <Link href="/contact" className="btn-secondary px-8">Get in Touch</Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "AboutPage",
                name: "About DS Racing Karts",
                url: `${siteUrl}/about`,
                description: "Learn about DS Racing Karts, its racing background, founder Dion Scott, and supported endurance karting teams.",
              },
              {
                "@type": "Person",
                name: "Dion Scott",
                jobTitle: "Founder & Lead Engineer",
                worksFor: {
                  "@type": "Organization",
                  name: "DS Racing Karts",
                  url: siteUrl,
                },
              },
            ],
          }),
        }}
      />
    </>
  );
}

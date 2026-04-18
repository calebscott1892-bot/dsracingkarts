import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Users, Wrench, Clock, Quote, Flag } from "lucide-react";
import TeamProfileCarousel from "@/components/sections/TeamProfileCarousel";

export const metadata: Metadata = {
  title: "About Us | DS Racing Karts",
  description: "Nearly 40 years experience in karting & decades more in motorsport. Sydney's trusted kart specialists.",
};

export default function AboutPage() {
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
            With nearly 40 years of experience in karting alone — and even longer in motorsport in general —
            DS Racing Karts is Sydney&apos;s most trusted name in kart sales, servicing, and race preparation.
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
          {["338", "43", "114", "5", "555", "272", "285", "22", "249"].map((num) => (
            <span
              key={num}
              className="font-heading text-xs uppercase tracking-[0.15em] text-white/30 border border-white/10 px-2 py-1"
            >
              #{num}
            </span>
          ))}
        </div>

        <TeamProfileCarousel />
      </section>

      <div className="chequered-stripe" />

      {/* ── Section 3: Results ── */}
      <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center gap-3 mb-10">
          <span className="h-[1px] w-8 bg-racing-red" />
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
            <span className="text-racing-red">Results</span>
          </h2>
        </div>
        <div className="space-y-3">
          {[
            { year: "2024", achievement: "ERC Podium Finishes" },
            { year: "2023", achievement: "Multiple Endurance Race Victories" },
            { year: "2021", achievement: "SEK Class Wins" },
            { year: "Ongoing", achievement: "DSR Predator Chassis Development" },
            { year: "All Time", achievement: "Hundreds of race wins across sprint & endurance karting" },
          ].map((item) => (
            <div key={item.year} className="flex gap-4 p-4 bg-white/5 border-l-[3px] border-l-racing-red">
              <span className="font-digital text-sm text-racing-red min-w-[70px]">{item.year}</span>
              <span className="text-sm text-white/70">{item.achievement}</span>
            </div>
          ))}
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

      {/* Stats */}
      <section className="bg-racing-black carbon-fiber py-16">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Clock, value: "40", label: "Years in Karting" },
            { icon: Wrench, value: "500+", label: "Parts in Stock" },
            { icon: Trophy, value: "100s", label: "Race Wins" },
            { icon: Users, value: "1000+", label: "Karts Serviced" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center">
              <Icon size={28} className="text-racing-red mx-auto mb-3" strokeWidth={1.5} />
              <div className="font-digital text-3xl text-white mb-1">{value}</div>
              <div className="font-heading text-xs uppercase tracking-[0.2em] text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="chequered-stripe" />

      {/* ── Section 4: Chassis Knowledge ── */}
      <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
        <div className="flex items-center gap-3 mb-10">
          <span className="h-[1px] w-8 bg-racing-red" />
          <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
            Know Your <span className="text-racing-red">Chassis</span>
          </h2>
        </div>

        {/* Sprint chassis */}
        <div className="mb-12">
          <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-4">
            What is a Sprint Go Kart Chassis?
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            A sprint go kart chassis is a lightweight, open-wheel frame designed for sprint racing on
            short, bitumen circuits. It differs from oval or enduro kart chassis in its construction,
            handling characteristics, and intended use.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {[
              { label: "Tubular Frame", detail: "Made of steel tubing, typically 28mm–32mm in diameter, with no suspension — flex in the chassis itself aids handling." },
              { label: "Wheelbase", detail: "Generally around 1040mm–1060mm for adult karts and shorter for junior karts." },
              { label: "Adjustability", detail: "Many chassis allow for adjustments in camber, caster, ride height, and seat position to optimise handling." },
              { label: "Braking System", detail: "Hydraulic disc brakes, usually only on the rear axle, though some high-end models have front brakes for advanced classes." },
              { label: "Steering", detail: "Direct steering with a simple tie rod and spindle setup." },
              { label: "Axle", detail: "Hollow metal axle (typically 30mm–50mm in diameter) with various levels of stiffness to affect handling." },
              { label: "Tyres & Wheels", detail: "Slick or wet tyres depending on weather conditions, mounted on lightweight aluminium or magnesium wheels." },
            ].map((spec) => (
              <div key={spec.label} className="p-4 bg-white/5 border-l-[3px] border-l-racing-red">
                <h4 className="font-heading text-xs uppercase tracking-[0.15em] text-white mb-1">{spec.label}</h4>
                <p className="text-sm text-white/60 leading-relaxed">{spec.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-white/70 leading-relaxed">
            In most cases these will have a 2-stroke engine from Yamaha or more powerful versions like
            a Leopard or a Rotax. The choice of chassis and engine depends on the age of the driver,
            their weight, and what they intend to do with the go kart in terms of racing category.
          </p>
        </div>

        {/* Endurance chassis */}
        <div className="mb-12">
          <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-4">
            What is an Endurance Go Kart Chassis?
          </h3>
          <p className="text-white/70 leading-relaxed mb-4">
            An endurance go kart chassis in many instances is the same as a sprint chassis but most
            likely will have a 4-stroke engine fitted to it. It will use similar plastics, seat,
            steering wheel, rims and tyres but have the less powerful but more reliable 4-stroke motor fitted.
          </p>
          <p className="text-white/70 leading-relaxed">
            For some categories a twin engine endurance go kart chassis will be used where there is an
            engine on the left and right of the rear of the kart, typically a Honda GX200 or Briggs
            &amp; Stratton L206 or Animal engine. This type of go kart is used for endurance racing
            with races of 2, 3, 6 or 24 hours in length.
          </p>
        </div>

        {/* DSR Predator */}
        <div className="bg-racing-black p-8 md:p-10">
          <h3 className="font-heading text-lg uppercase tracking-[0.1em] text-white mb-4">
            Can You Buy an Australian Designed Endurance Go Kart Chassis?
          </h3>
          <p className="text-text-secondary leading-relaxed mb-6">
            The Predator Chassis is an Australian design that is manufactured in Sydney to be used for
            twin engine endurance go karting events. Designed by experienced race car driver Dion, it
            is a chassis used by many teams that has won numerous titles and races.
          </p>
          <Link href="/contact" className="btn-primary px-8">Enquire About the Predator</Link>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4"><div className="racing-line" /></div>

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
    </>
  );
}

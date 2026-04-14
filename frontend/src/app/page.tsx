"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Search,
  ShieldCheck,
  FileCheck,
  Star,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Clock,
  Ban,
  Bell,
  BarChart3,
} from "lucide-react";
import { STATIC_IMAGES } from "@/lib/unsplash";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

// ─── HERO ──────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${STATIC_IMAGES.heroMumbai})` }}
      />
      <div className="absolute inset-0 bg-charcoal/55" />

      {/* Navbar */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-1">
          <span className="font-playfair italic text-2xl text-white">griha</span>
          <span className="font-playfair text-2xl text-warm-gold font-bold">AI</span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-white/80 hover:text-white text-sm font-dm transition-colors">How it works</a>
          <a href="#features" className="text-white/80 hover:text-white text-sm font-dm transition-colors">Features</a>
          <a href="#pricing" className="text-white/80 hover:text-white text-sm font-dm transition-colors">Pricing</a>
          <Link href="/sign-in" className="bg-white/10 hover:bg-white/20 text-white text-sm font-dm px-4 py-2 rounded-full border border-white/20 transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Content */}
      <motion.div
        className="relative z-10 text-center max-w-4xl px-6"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          variants={fadeUp}
          className="font-playfair text-6xl md:text-7xl lg:text-[76px] text-white leading-tight"
        >
          Find Your Home.
          <br />
          <span className="text-warm-gold">Without the Headache.</span>
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="font-dm text-lg md:text-xl text-white/80 mt-6 max-w-2xl mx-auto"
        >
          Griha AI searches listings, verifies legals, negotiates with brokers, and reviews contracts.
          You just make the final call.
        </motion.p>
        <motion.div variants={fadeUp}>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 bg-warm-gold hover:bg-warm-gold/90 text-charcoal font-dm font-semibold text-lg px-8 py-4 rounded-full mt-8 transition-all hover:scale-105 hover:shadow-xl"
          >
            Find My Home
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-8 mt-12"
        >
          {[
            { value: "12,400+", label: "Properties Verified" },
            { value: "8,200+", label: "Contracts Reviewed" },
            { value: "94%", label: "Found a home in 3 weeks" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-playfair text-2xl text-white font-bold">{stat.value}</p>
              <p className="text-white/60 text-sm font-dm mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
          <motion.div
            className="w-1.5 h-2.5 bg-white/60 rounded-full"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}

// ─── HOW IT WORKS ──────────────────────────────────────
const STEPS = [
  { icon: MessageCircle, title: "Tell us what you want", desc: "Share your preferences in a quick chat — budget, location, must-haves." },
  { icon: Search, title: "We search everything", desc: "Griha AI scans thousands of listings across all major platforms instantly." },
  { icon: ShieldCheck, title: "AI verifies & negotiates", desc: "Legal checks, photo analysis, and smart negotiation — all automated." },
  { icon: FileCheck, title: "You just sign", desc: "Review AI-vetted options and sign. The hard work is already done." },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-cream">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-playfair text-4xl md:text-5xl text-charcoal">How It Works</h2>
          <p className="text-muted font-dm mt-4 text-lg">Four steps. Zero stress.</p>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 border-t-2 border-dashed border-sand" />
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-full bg-warm-gold text-charcoal flex items-center justify-center font-bold text-sm z-10 mb-4">
                {i + 1}
              </div>
              <div className="w-14 h-14 rounded-2xl bg-forest/10 flex items-center justify-center mb-4">
                <step.icon className="w-7 h-7 text-forest" />
              </div>
              <h3 className="font-dm font-bold text-charcoal text-lg">{step.title}</h3>
              <p className="text-muted text-sm mt-2 max-w-[220px]">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FEATURES BENTO ────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-charcoal">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-playfair text-4xl md:text-5xl text-white">
            Everything AI Can Do <span className="text-warm-gold">For You</span>
          </h2>
          <p className="text-white/60 font-dm mt-4 text-lg">Powered by intelligence. Built for peace of mind.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px]">
          {/* Large card - Negotiation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02, borderColor: "rgba(201,146,42,0.5)" }}
            className="md:col-span-2 md:row-span-2 bg-charcoal border border-white/10 rounded-2xl p-6 flex flex-col transition-all"
          >
            <h3 className="font-dm font-bold text-white text-lg mb-4">Real-time Negotiation</h3>
            <div className="flex-1 space-y-3 overflow-hidden">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">G</span>
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-2.5 text-white/80 text-sm max-w-[85%]">
                  Hi, I&apos;m reaching out about the 2BHK at Sea Breeze Tower. Given comparable properties at &#8377;70-80K, would you consider &#8377;72,000/month?
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5 text-white/80 text-sm max-w-[85%]">
                  The owner&apos;s minimum is &#8377;82,000. We&apos;ve had multiple inquiries.
                </div>
                <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs">B</span>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">G</span>
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-2.5 text-white/80 text-sm max-w-[85%]">
                  Similar 2BHKs nearby are &#8377;72-78K. With immediate commitment + 2 months deposit, could we settle at &#8377;76,000?
                </div>
              </div>
            </div>
            <p className="text-white/40 text-xs mt-4 font-dm">Griha AI negotiates with brokers on WhatsApp — you approve every move.</p>
          </motion.div>

          {/* Medium card - Legal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, borderColor: "rgba(201,146,42,0.5)" }}
            className="md:col-span-2 bg-charcoal border border-white/10 rounded-2xl p-6 transition-all"
          >
            <h3 className="font-dm font-bold text-white text-lg mb-3">Legal Risk Assessment</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> RERA Registered
              </span>
              <span className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Title Clear
              </span>
              <span className="px-3 py-1 rounded-full bg-warm-gold/20 text-warm-gold text-xs font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Tax Dues Pending
              </span>
              <span className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Builder A-rated
              </span>
            </div>
            <p className="text-white/40 text-xs mt-3 font-dm">Automated checks on RERA, encumbrance, tax, and builder record.</p>
          </motion.div>

          {/* Small card - Daily Digest */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, borderColor: "rgba(201,146,42,0.5)" }}
            className="bg-charcoal border border-white/10 rounded-2xl p-6 transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-warm-gold" />
              <h3 className="font-dm font-bold text-white text-sm">Daily Digest</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-success" /> 3 new matches found
              </div>
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-warm-gold" /> 1 price drop alert
              </div>
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-forest-light" /> Negotiation update
              </div>
            </div>
          </motion.div>

          {/* Small card - Fake Detection */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            whileHover={{ scale: 1.02, borderColor: "rgba(201,146,42,0.5)" }}
            className="bg-charcoal border border-white/10 rounded-2xl p-6 transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <Ban className="w-4 h-4 text-danger" />
              <h3 className="font-dm font-bold text-white text-sm">Fake Detection</h3>
            </div>
            <div className="relative">
              <div className="text-white/30 text-xs line-through">2BHK Bandra &#8377;35K — Too good</div>
              <div className="mt-1 px-2 py-0.5 bg-danger/20 text-danger text-xs font-semibold rounded inline-block">
                Duplicate Detected
              </div>
            </div>
          </motion.div>

          {/* Medium card - Neighbourhood */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, borderColor: "rgba(201,146,42,0.5)" }}
            className="md:col-span-2 bg-charcoal border border-white/10 rounded-2xl p-6 transition-all"
          >
            <h3 className="font-dm font-bold text-white text-lg mb-3">Neighbourhood Intelligence</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: MapPin, label: "Metro", value: "350m" },
                { icon: Clock, label: "Commute", value: "28 min" },
                { icon: BarChart3, label: "AQI", value: "Good" },
                { icon: Star, label: "Livability", value: "8.4/10" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <item.icon className="w-5 h-5 text-forest-light mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">{item.value}</p>
                  <p className="text-white/40 text-xs">{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── TESTIMONIALS ──────────────────────────────────────
const TESTIMONIALS = [
  { name: "Priya Sharma", city: "Mumbai", stars: 5, quote: "Griha AI found my dream 2BHK in Bandra within 2 weeks. The negotiation agent saved me ₹8,000/month. I didn't talk to a single broker." },
  { name: "Rahul Desai", city: "Pune", stars: 5, quote: "The legal check caught a title dispute that would have been a nightmare. Griha AI literally saved me from signing a lease on a property with pending litigation." },
  { name: "Ananya Reddy", city: "Bangalore", stars: 4, quote: "As someone relocating from Delhi, I had zero local knowledge. The neighbourhood intelligence helped me pick HSR Layout over Koramangala — better commute, lower rent." },
];

function TestimonialsSection() {
  return (
    <section className="py-24 bg-sand">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-playfair text-4xl md:text-5xl text-charcoal">What Our Users Say</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface rounded-2xl p-6 border border-border-custom"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-warm-gold text-warm-gold" />
                ))}
              </div>
              <p className="text-charcoal font-dm text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 pt-4 border-t border-border-custom">
                <p className="font-dm font-semibold text-charcoal text-sm">{t.name}</p>
                <p className="text-muted text-xs">{t.city}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PRICING ───────────────────────────────────────────
function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-cream">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-playfair text-4xl md:text-5xl text-charcoal">Simple Pricing</h2>
          <p className="text-muted font-dm mt-4 text-lg">Start free. Upgrade when you need more power.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-surface rounded-2xl p-8 border border-border-custom"
          >
            <h3 className="font-dm font-bold text-charcoal text-xl">Free</h3>
            <div className="mt-2">
              <span className="font-playfair text-4xl text-charcoal">&#8377;0</span>
              <span className="text-muted text-sm ml-1">/ forever</span>
            </div>
            <ul className="mt-6 space-y-3">
              {["5 property matches/day", "Basic legal check", "Neighbourhood overview", "Email digest"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-charcoal font-dm">
                  <CheckCircle className="w-4 h-4 text-success shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-in"
              className="block text-center mt-8 py-3 px-6 border-2 border-charcoal text-charcoal font-dm font-semibold rounded-full hover:bg-charcoal hover:text-white transition-all"
            >
              Start Free
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-surface rounded-2xl p-8 border-2 border-forest relative"
          >
            <span className="absolute -top-3 right-6 bg-warm-gold text-charcoal text-xs font-bold px-3 py-1 rounded-full">
              Most Popular
            </span>
            <h3 className="font-dm font-bold text-charcoal text-xl">Pro</h3>
            <div className="mt-2">
              <span className="font-playfair text-4xl text-charcoal">&#8377;999</span>
              <span className="text-muted text-sm ml-1">/ month</span>
            </div>
            <ul className="mt-6 space-y-3">
              {["Unlimited matches", "AI negotiation agent", "Full legal & RERA check", "Contract review & redline", "Photo intelligence", "Neighbourhood deep-dive", "Priority support"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-charcoal font-dm">
                  <CheckCircle className="w-4 h-4 text-forest shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-in"
              className="block text-center mt-8 py-3 px-6 bg-forest text-white font-dm font-semibold rounded-full hover:bg-forest-light transition-all"
            >
              Start 7-day Free Trial
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-charcoal py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <span className="font-playfair italic text-2xl text-white">griha</span>
              <span className="font-playfair text-2xl text-warm-gold font-bold">AI</span>
            </div>
            <p className="text-white/50 text-sm font-dm">
              AI-powered property finding. Search, verify, negotiate, sign — all automated.
            </p>
          </div>
          <div>
            <h4 className="font-dm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              {["How it works", "Features", "Pricing", "FAQ"].map((l) => (
                <li key={l}><a href="#" className="text-white/50 hover:text-white text-sm font-dm transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-dm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
                <li key={l}><a href="#" className="text-white/50 hover:text-white text-sm font-dm transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-dm font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2">
              {["hello@griha.ai", "Twitter", "LinkedIn"].map((l) => (
                <li key={l}><a href="#" className="text-white/50 hover:text-white text-sm font-dm transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-white/30 text-sm font-dm">&copy; 2024 Griha AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────
export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <Footer />
    </main>
  );
}

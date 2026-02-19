import { motion } from 'framer-motion';
import { Button } from './Button';
import { siteContent } from '../../content/site';

export function Hero({ onOpenForm }) {
  return (
    <section className="section-wrap grid gap-8 py-12 md:grid-cols-2 md:py-20">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">{siteContent.hero.title}</h1>
        <p className="text-zinc-300">{siteContent.hero.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          {siteContent.hero.badges.map((badge) => (
            <span key={badge} className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200">
              {badge}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={onOpenForm}>Проверить дату</Button>
          <a href={siteContent.whatsappUrl} target="_blank" rel="noreferrer"><Button variant="secondary" size="lg">Написать в WhatsApp</Button></a>
        </div>
        <p className="text-sm text-zinc-400">Ответим в течение {siteContent.responseHours} часов. Быстрый созвон — 15 минут.</p>
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-[320px] rounded-[2.5rem] border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
        <div className="relative overflow-hidden rounded-[2rem]">
          <div className="h-[520px] w-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-zinc-600">
            <p className="text-sm">Видео будет здесь</p>
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hero } from '../components/landing/Hero';
import { siteContent } from '../content/site';
import { Card } from '../components/landing/Card';
import { FAQAccordion } from '../components/landing/Accordion';
import { Button } from '../components/landing/Button';
import { DialogContent, DialogRoot } from '../components/landing/Dialog';
import { LeadForm } from '../components/landing/LeadForm';

export default function Landing() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('все');
  const portfolio = useMemo(
    () => siteContent.portfolio.filter((i) => filter === 'все' || i.type === filter),
    [filter]
  );

  return (
    <div className="bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="section-wrap flex h-14 items-center justify-between">
          <span className="font-semibold">{siteContent.brand}</span>
          <nav className="hidden gap-4 text-sm md:flex">
            {siteContent.nav.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
            <Link to="/admin" className="text-zinc-400 hover:text-zinc-100">Админ</Link>
          </nav>
        </div>
      </header>

      <Hero onOpenForm={() => setOpen(true)} />

      <section id="team" className="section-wrap space-y-4 py-14"><h2 className="text-3xl font-bold">Мы работаем командой — поэтому у вас всё под контролем</h2><div className="grid gap-4 md:grid-cols-2">{siteContent.team.map((m) => <Card key={m.name}><p className="text-xs text-brand-500">{m.role}</p><h3 className="text-xl font-semibold">{m.name}</h3><p className="text-zinc-300">{m.text}</p></Card>)}</div></section>

      <section className="section-wrap py-14"><h2 className="mb-4 text-3xl font-bold">Как мы работаем</h2><div className="grid gap-4 md:grid-cols-3">{siteContent.process.map((s, i) => <Card key={s}><p className="mb-2 text-xs text-brand-500">Шаг {i + 1}</p>{s}</Card>)}</div></section>

      <section id="pricing" className="section-wrap py-14"><h2 className="mb-4 text-3xl font-bold">Пакеты</h2><div className="grid gap-4 md:grid-cols-3">{siteContent.pricing.map((p) => <Card key={p.title}><h3 className="text-lg font-semibold">{p.title}</h3><p className="text-zinc-300">{p.line}</p><p className="mt-3 text-2xl font-bold">{p.price}</p><p className="text-sm text-zinc-400">{p.extra}</p></Card>)}</div><p className="mt-4 text-sm text-zinc-400">Финальная смета зависит от даты, локации, длительности и количества гостей.</p></section>

      <section className="section-wrap grid gap-4 py-14 md:grid-cols-2"><Card><h3 className="mb-2 text-2xl font-semibold">Будет</h3><ul className="space-y-2 text-zinc-300">{siteContent.will.map((i) => <li key={i}>• {i}</li>)}</ul></Card><Card><h3 className="mb-2 text-2xl font-semibold">Не будет</h3><ul className="space-y-2 text-zinc-300">{siteContent.wont.map((i) => <li key={i}>• {i}</li>)}</ul></Card></section>

      <section id="portfolio" className="section-wrap py-14"><h2 className="text-3xl font-bold">Видео и моменты — лучше любых обещаний</h2><p className="mb-4 text-zinc-300">Коротко: вот как это звучит и выглядит.</p><div className="mb-4 flex flex-wrap gap-2">{siteContent.portfolioFilters.map((f) => <Button key={f} variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>{f}</Button>)}</div><div className="grid gap-4 md:grid-cols-3">{portfolio.map((item, idx) => <Card key={`${item.title}-${idx}`}><div className="mb-3 aspect-video rounded-lg bg-zinc-800" /><h3 className="font-semibold">{item.title}</h3><p className="text-xs uppercase text-brand-500">{item.type}</p><p className="text-sm text-zinc-300">{item.description}</p></Card>)}</div></section>

      <section className="section-wrap py-14"><Card><h2 className="text-3xl font-bold">Интерактивы, которые не стыдно показывать</h2><p className="my-3 text-zinc-300">Короткие квизы и командные штуки между блоками — чтобы гости вовлекались, но не уставали.</p><ul className="grid gap-2 md:grid-cols-2">{siteContent.quizzes.map((q) => <li key={q}>• {q}</li>)}</ul></Card></section>

      <section className="section-wrap py-14"><h2 className="mb-4 text-3xl font-bold">Отзывы</h2><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((n)=><Card key={n}><p className="text-zinc-300">"Сюда добавим реальный отзыв клиента с фото и форматом мероприятия."</p></Card>)}</div></section>

      <section id="faq" className="section-wrap py-14"><h2 className="mb-4 text-3xl font-bold">FAQ</h2><FAQAccordion items={siteContent.faq} /></section>

      <section id="contact" className="section-wrap py-14"><Card className="text-center"><h2 className="text-3xl font-bold">Проверим дату и сделаем предложение</h2><p className="my-3 text-zinc-300">Заполните 4 поля — остальное уточним в созвоне.</p><Button onClick={() => setOpen(true)}>Открыть форму</Button></Card></section>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950 p-3 md:hidden"><div className="section-wrap flex gap-2"><a className="flex-1" href={siteContent.whatsappUrl} target="_blank" rel="noreferrer"><Button className="w-full" variant="secondary">WhatsApp</Button></a><Button className="flex-1" onClick={() => setOpen(true)}>Проверить дату</Button></div></div>

      <DialogRoot open={open} onOpenChange={setOpen}><DialogContent><LeadForm onDone={() => setOpen(false)} /></DialogContent></DialogRoot>
    </div>
  );
}

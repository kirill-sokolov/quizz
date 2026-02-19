import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from './Button';
import { Input, Textarea } from './Input';
import { siteContent } from '../../content/site';

const schema = z.object({
  date: z.string().min(1, 'Укажите дату'),
  city: z.string().min(2, 'Укажите город'),
  event_type: z.string().min(2, 'Укажите формат'),
  contact: z.string().min(4, 'Укажите контакт'),
  guest_count: z.string().optional(),
  coordinator_needed: z.boolean().optional(),
  venue_link: z.string().optional(),
  notes: z.string().optional(),
  company: z.string().max(0).optional()
});

export function LeadForm({ onDone }) {
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [rateBlocked, setRateBlocked] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, trigger } = useForm({ resolver: zodResolver(schema) });

  const lastSubmit = useMemo(() => Number(localStorage.getItem('lead-last-submit') ?? 0), []);

  const nextStep = async () => {
    const ok = await trigger(['date', 'city', 'event_type', 'contact']);
    if (ok) setStep(2);
  };

  const onSubmit = handleSubmit(async (data) => {
    if (data.company) return;
    if (Date.now() - lastSubmit < 30_000) {
      setRateBlocked(true);
      return;
    }
    localStorage.setItem('lead-last-submit', String(Date.now()));
    localStorage.setItem('lead-last-data', JSON.stringify(data));
    console.log('mock-api', data);
    setSuccess(true);
  });

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-2xl font-semibold">Спасибо! Ответим в течение {siteContent.responseHours} часов</h3>
        <a href={siteContent.whatsappUrl} target="_blank" rel="noreferrer"><Button>Написать в WhatsApp</Button></a>
        <div><Button variant="outline" onClick={onDone}>Закрыть</Button></div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {step === 1 && (
        <>
          <Input type="date" {...register('date')} />{errors.date && <p className="text-xs text-red-400">{errors.date.message}</p>}
          <Input placeholder="Город" {...register('city')} />{errors.city && <p className="text-xs text-red-400">{errors.city.message}</p>}
          <Input placeholder="Формат (свадьба/корпоратив)" {...register('event_type')} />{errors.event_type && <p className="text-xs text-red-400">{errors.event_type.message}</p>}
          <Input placeholder="Телефон / Telegram / Email" {...register('contact')} />{errors.contact && <p className="text-xs text-red-400">{errors.contact.message}</p>}
          <Input className="hidden" tabIndex={-1} autoComplete="off" {...register('company')} />
          <Button type="button" onClick={nextStep}>Далее</Button>
        </>
      )}
      {step === 2 && (
        <>
          <Input placeholder="Количество гостей" {...register('guest_count')} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('coordinator_needed')} /> Нужен координатор</label>
          <Input placeholder="Ссылка на площадку" {...register('venue_link')} />
          <Textarea placeholder="Пожелания" {...register('notes')} />
          {rateBlocked && <p className="text-xs text-amber-400">Слишком частые отправки. Попробуйте через 30 секунд.</p>}
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => setStep(1)}>Назад</Button>
            <Button type="submit" disabled={isSubmitting}>Отправить</Button>
          </div>
        </>
      )}
    </form>
  );
}

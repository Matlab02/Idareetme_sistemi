# Təchizat İdarəetmə ERP

Next.js, TypeScript, PostgreSQL və Prisma əsasında qurulmuş ERP üçün production-ready başlanğıc arxitekturası.

## Hazır olan baza

- Normalized Prisma domain modeli: sorğular, təklif versiyaları, satış/alış, lot əsaslı anbar, FIFO allocation, qaimələr, ödənişlər, sənədlər, AI extraction, RBAC, audit və security log.
- Atomic business xidmətləri: quotation acceptance, gələn qaimənin stok girişinə çevrilməsi və FIFO ilə gedən qaimənin stok çıxışı.
- Zod ilə server-side request validation və mərkəzi audit servisi.
- Responsive, dark-mode dəstəkli SaaS dashboard və sorğular ekranı.

## Lokal işə salma

1. Node.js 20+ və PostgreSQL quraşdırın.
2. `.env.example` faylını `.env` kimi kopyalayıb `DATABASE_URL` dəyərini doldurun.
3. `npm install`
4. `npm run db:push`
5. `npm run dev`

## Vacib prinsip

Maliyyə və stok uçotuna təsir edən qeydiyyatlar silinmir; onların statusu `VOID`, `CANCELLED` və ya `ARCHIVED` edilə bilər. Qaimələrin təsdiqlənməsi yalnız transaction içində həyata keçirilir.

---
version: alpha
name: "AzPlom Təchizat İdarəetmə Sistemi"
description: "Azərbaycan dilində işləyən təchizat komandası üçün sakit, yüksək sıxlıqlı və izlənə bilən əməliyyat masası."
colors:
  navy: "#075B93"
  navy-deep: "#063E66"
  brand: "#0B78BE"
  ai: "#7657D6"
  background: "#EDF5F7"
  surface: "#FFFFFF"
  surface-subtle: "#F7F9FC"
  text: "#14243E"
  muted: "#687A94"
  border: "#D8E6EB"
  success: "#168663"
  warning: "#B97308"
  danger: "#C83E53"
typography:
  display:
    fontFamily: "Aptos Display, Segoe UI Variable Display, Segoe UI, sans-serif"
  body:
    fontFamily: "Aptos, Segoe UI Variable Text, Segoe UI, sans-serif"
  data:
    fontFamily: "Aptos Mono, Cascadia Mono, ui-monospace, monospace"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.875rem"
  xl: "1rem"
spacing:
  control: "0.75rem"
  panel: "1.25rem"
  page: "2rem"
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
  field: {}
  badge: {}
---

# AzPlom ERP Design System

## Overview

### Creative North Star

İnterfeys təchizat şöbəsinin səliqəli əməliyyat masası kimi hiss olunmalıdır: sənəd, qiymət, stok və status bir baxışda seçilir. Figma ERP Dashboard Community nümunəsindən götürülən sıx analitik kompozisiya AzPlom-un mavi naviqasiyası və Azərbaycan dilindəki real əməliyyatlarla birləşdirilir.

### Product context and register

- **Audience and primary job:** AzPlom admin və superadmin istifadəçiləri sorğu, qaimə, anbar, sənəd, maliyyə və audit əməliyyatlarını idarə edir.
- **Target market:** Azərbaycan; məhsul dili Azərbaycan dilidir.
- **Locale and time:** `az-AZ`, `Asia/Baku`, Qriqorian təqvimi.
- **Usage scene:** Əsasən desktop, uzun iş sessiyaları və sıx cədvəllər; tablet və mobil baxış da qorunur.
- **Register:** Tam məhsul/admin interfeysi.
- **Memorable signature:** Sorğunun vəziyyətini və sənəd tamamlığını bir xətt üzrə oxudan “əməliyyat izi”, dashboardda isə incə rəng kodlu KPI üst xətləri.
- **Restraint:** Cədvəl, forma, maliyyə və təhlükəli əməliyyatlarda tanışlıq və dəqiqlik vizual effektlərdən üstündür.
- **Anti-references:** Sadə CRUD şablonu, həddən artıq gradient, parlaq şüşə effektləri, böyük boş marketinq kartları.
- **Token ownership:** Mövcud runtime CSS kanonikdir; bu fayl `design-system.css` dəyişənlərini və niyyətini sənədləşdirir.

## Colors

Figma nümunəsindəki əməliyyat mavisi AzPlom brendinə uyğun dərinləşdirilərək sidebar və əsas hərəkətlərdə istifadə olunur. Bənövşəyi yalnız AI, yaşıl/narıncı/qırmızı isə semantik status üçündür. Solğun mavi-boz iş sahəsində sərhəd və tonal səthlər iyerarxiyanı kölgədən əvvəl qurur. Dark mode eyni semantik rolları saxlayır.

## Typography

Başlıqda Aptos Display/Segoe UI Variable Display, mətn və idarə elementlərində Aptos/Segoe UI istifadə edilir. Məbləğ, SKU, say və identifikatorlar tabular rəqəm quruluşu ilə göstərilir. Bütün düymə və sütun adları Azərbaycan dilində cümlə registrində saxlanır.

## Layout

Desktopda 252px sabit naviqasiya, 66px topbar və maksimum 1600px iş sahəsi var. Figma nümunəsindəki sıx analitik ritmə uyğun panel aralığı 14–18px, nəzarət elementləri minimum 40px hündürlükdədir. Cədvəlin üfüqi skrolu yalnız öz konteynerinə məxsusdur. 900px-dən aşağı sidebar drawer olur; 640px-dən aşağı kartlar bir sütuna keçir.

## Elevation & Depth

Səthlər əvvəlcə ton və sərhədlə ayrılır. Statik kartlarda çox yumşaq kölgə, hover və modalda daha aydın kölgə istifadə olunur. Sticky topbar bulanıq ağ/navy səthdir. Cədvəl sətrlərinə daimi kölgə verilmir.

## Shapes

Input və düymələr 10–12px, panellər 16–20px radius istifadə edir. Statuslar pill, ikon düymələri yumşaq kvadratdır. Təhlükəli əməliyyat vizual olaraq əsas təhlükəsiz əməliyyatdan ayrılır.

## Components

### Foundational visual states

Hər interaktiv elementdə hover, pressed, aydın `focus-visible`, disabled və busy halı olmalıdır. Fokus halqası mavi, xəta halqası qırmızıdır. Hərəkət azaldılması aktiv olduqda keçidlər söndürülür.

### Buttons and actions

Əsas əməliyyat navy solid, ikinci əməliyyat ağ outline, təhlükəli əməliyyat əvvəlcə sakit danger outline, son təsdiqdə solid danger olur. Düymə ölçüsü busy halda dəyişmir.

### Navigation and data display

Sidebar bölmələri qruplaşdırır; aktiv səhifə mavi xətt və tonal səthlə göstərilir. Cədvəl başlığı sticky, məbləğlər tabular və sağa, statuslar badge kimi hizalanır. Mobil cədvəl öz daxilində sürüşür.

### Forms and overlays

Label inputdan yuxarıdır; kömək və xəta mətni üçün sabit yer saxlanır. Modal vizual viewport daxilində qalır, başlıq və əməliyyatlar əlçatan olur. Scrollbar bütün tətbiq üçün vahiddir.

### Iconography

Mövcud sadə xətti işarələr saxlanır; əməliyyat ikonları həmişə mətn etiketi və ya əlçatan adla müşayiət olunur.

### Motion

150–220ms ease-out yalnız vəziyyət dəyişikliyi, hover, drawer və modal üçün istifadə olunur; dekorativ daimi animasiya yoxdur.

### Content and data visualization

Dil qısa və əməliyyat yönümlüdür. Məbləğlər `az-AZ`, iki onluq rəqəm və valyuta ilə; tarixlər eyni formatla göstərilir. Rəng məlumatın yeganə daşıyıcısı deyil.

## Do's and Don'ts

- **Do:** Bir baxışda status, məbləğ və növbəti əməliyyatı görünən et.
- **Do:** Eyni əməliyyat üçün bütün ekranlarda eyni komponent və söz istifadə et.
- **Don't:** Bir ekran üçün ayrıca rəng, radius və kölgə dili yaratma.
- **Don't:** Sıx əməliyyat cədvəllərini böyük dekorativ kartlarla əvəz etmə.

# GeoGuard - Strategiya və Təhlükəsizliyin Kəsişməsi

## Məqsəd
Riyaziyyat və müasir proqramlaşdırma texnologiyalarını hərbi sahədə tətbiq edərək təhlükəsiz, çevik və real-zamanlı strateji idarəetmə platforması yaratmaq.

## Konsepsiya
GeoGuard, müasir döyüş şəraitinin tələblərinə cavab verən, mərkəzləşdirilmiş bir komanda-kontrol platformasıdır. Sistemin əsas məqsədi, hərbi bölüklərin mövqelərini təhlükəsiz şəkildə izləmək, əməliyyatları real-zamanlı idarə etmək və bütün məlumat axınını mürəkkəb riyazi alqoritmlərlə şifrələyərək düşmən müdaxiləsindən qorumaqdır.

Platforma, real-zamanlı məlumat sinxronizasiyası üçün **Firebase Firestore**, təhlükəsiz autentikasiya və müasir istifadəçi interfeysi üçün **Next.js**, **React** və **TailwindCSS** kimi qabaqcıl texnologiyalardan istifadə edir.

## Özünəməxsus Şifrələmə Mühərriki
GeoGuard sisteminin fərqləndirici xüsusiyyəti onun çoxqatmanlı şifrələmə mühərrikidir. Bu mühərrik, sadəcə bir funksiya deyil, sistemin təməlini təşkil edir və bütün kritik məlumatların təhlükəsizliyini təmin edir. Məlumatların şifrələnməsi, bir-birini tamamlayan 5 fərqli riyazi və alqoritmik qatdan ibarətdir:

1.  **Kollats Fərziyyəsi ilə Qarışdırma (Collatz Conjecture Scrambling):** Koordinatların ilkin qarışdırılması üçün riyaziyyatın həll olunmamış problemlərindən biri olan Kollats fərziyyəsinə əsaslanan alqoritmdən istifadə edilir.
2.  **Sadə Ədədlə Atlama (Prime-Jump Encryption):** Şifrələmə açarından yaradılan təsadüfi sadə ədədlərə əsaslanaraq koordinatların dəyərini dəyişdirir.
3.  **Fibonaççi Spiral Sürüşdürməsi (Fibonacci Spiral Displacement):** Qızıl bucaq və Fibonaççi ardıcıllığından ilhamlanaraq koordinatlara spiralvari və qeyri-xətti bir yerdəyişmə tətbiq edir.
4.  **Affin Koordinat Transformasiyası (Affine Coordinate Transformation):** Koordinatları xətti cəbrin Affin çevrilmələri (döndərmə, miqyaslama, sürüşdürmə) vasitəsilə yeni bir müstəviyə köçürür.
5.  **Logarifmik Spiral Yerdəyişməsi (Logarithmic Spiral Displacement):** Təbiətdə tez-tez rast gəlinən logarifmik spiral formuluna əsaslanaraq koordinatlara son bir yerdəyişmə tətbiq edir.

### Şifrələmə Mühərrikinin Tətbiqi
Bu mühərrik aşağıdakı bütün proseslərdə aktiv şəkildə istifadə olunur:
-   **Koordinatların Təhlükəsizliyi:** Bütün bölüklərin real mövqeləri bu alqoritmlərlə şifrələnərək ötürülür.
-   **Daxili Kommunikasiya:** Baş komandir və sub-komandirlər arasındakı bütün məlumat axını və daxili **mesajlaşma sistemi** bu mühərriklə "şifrələnir" və verilənlər bazasında oxunmaz formatda saxlanılır.
-   **Yem Hədəf Yaratma (Decoy Generation):** Düşmən kəşfiyyatını yanıltmaq üçün yaradılan saxta koordinatlar (yemlər) məhz bu alqoritmlərin nəticəsidir.

## İdarəetmə Panelləri
Sistemdə iki fərqli səlahiyyətli panel mövcuddur:

### 1. Baş Komandir Paneli (`/komandir`)
-   **Vahid Əməliyyat Mənzərəsi:** Bütün bölükləri, təyin edilmiş hədəfləri və yem nöqtələrini vahid xəritədə izləyir.
-   **Strateji İdarəetmə:** Yeni bölüklər və sub-komandirlər yaradır, onların icazələrini (məsələn, bütün xəritəni görmə səlahiyyəti) tənzimləyir.
-   **Kəşfiyyata Qarşı Mübarizə:** Xəritədə təyin etdiyi "aktiv" hədəflər üçün şifrələmə mühərrikini işə salaraq saxta yem hədəflər yaradır və onları ictimai xəritəyə ötürür.

### 2. Sub-Komandir Paneli (`/sub-komandir`)
-   **Məhdud və Fokuslanmış Məlumat:** Standart olaraq yalnız öz bölüyünü və ona təyin edilmiş hədəfləri görür. Baş komandirin icazəsi ilə digər bölükləri də izləyə bilər.
-   **Əməliyyat İcrası:** Təyin olunmuş hədəflərə fokuslanaraq əməliyyatları icra edir. Strateji qərarvermə, yeni bölük yaratma və şifrələmə funksiyalarına çıxışı yoxdur.

## Hesab Təhlükəsizliyi və Anomaliya Təsbiti
GeoGuard, sadəcə məlumatları şifrələməklə kifayətlənmir, həm də hesabların təhlükəsizliyinə nəzarət edir.

-   **Anomaliya Təsbiti:** Sistem, bir hesaba eyni anda birdən çox cihazdan daxil olma cəhdini avtomatik olaraq **"potensial düşmən müdaxiləsi"** kimi qeydə alır.
-   **Gizli Monitorinq:** İkinci cihazdan daxil olan şəxs sistemin normal işlədiyini zənn edir, lakin onun bütün fəaliyyəti arxa planda izlənilir.
-   **Real-Zamanlı Xəbərdarlıq:** Müdaxilə baş verən anda baş komandirin panelində dərhal xəbərdarlıq görünür. Bu xəbərdarlıqda müdaxilənin vaxtı, cəhd edilən hesab, müdaxiləçinin IP ünvanı və təxmini coğrafi mövqeyi kimi kritik məlumatlar əks olunur. Bu, komandanlığa dərhal cavab tədbirləri görmək və təhlükəni zərərsizləşdirmək imkanı verir.
# sabahin-alimleri-prototip
# sabahin-alimleri-prototip
# sabahin-alimleri-prototip
# sabahin-alimleri-prototip-develop
# sabahin-alimleri-prototip-develop
# sabahin-alimleri-prototip-develop
# sabahin-alimleri-prototip-develop
# bezdim
# bezdim
# sabahin-alimeri-yeniledim-yene
# ISEF
# ISEF

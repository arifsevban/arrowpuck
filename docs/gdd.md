# Oyun Tasarım Belgesi (GDD): ArrowShot Widget

* **Sürüm:** 1.0.0
* **Durum:** Geliştirmeye Hazır (Ready for Implementation)
* **Hedef Kitle:** Geliştiriciler, Tasarımcılar, Portfolyo / Blog / Ajans Ziyaretçileri
* **Sınıflandırma:** Rahatsız Etmeyen Web Paskalya Yumurtası (Easter Egg) / İnteraktif Mikro Widget

---

## 1. Yönetici Özeti (Executive Summary)

`ArrowShot`, web sitelerine (portfolyolar, ajans sayfaları, bloglar, 404 sayfaları vb.) ortam gamifikasyonu eklemek üzere tasarlanmış, harici kütüphane bağımlılığı bulunmayan (zero-dependency) hafif bir mikro widget'tır.

Ziyaretçiyi sayfadan koparan veya ekranı kapatan kutu tipi pencereler açmak yerine; mevcut web sayfasının üzerine saydam, pasif ve tam ekran bir HTML5 `<canvas>` katmanı yerleştirir. Kullanıcı ekranın bir köşesindeki fırlatıcıyı (yay/sapan) fare veya dokunmatik ekranla geriye çekerek nişan alır, kesikli çizgiyle gösterilen parabolik rotayı takip eder ve sitenin diğer köşesindeki hedef tahtasını vurmaya çalışır.

---

## 2. Temel Tasarım İlkeleri (Core Pillars)

1. **Varsayılan Olarak İstilacı Olmama (Non-Intrusive):**
   Widget, ana web sitesinin okunabilirliğini veya kullanılabilirliğini asla bozmaz. Canvas varsayılan olarak `pointer-events: none` durumundadır; yalnızca yay bölgesine dokunulduğunda ve atış sırasında etkileşimi üzerine alır.
2. **Sıfır Dış Bağımlılık (Zero-Dependency):**
   Yalnızca saf Vanilla JavaScript (ES6+) ve yerel HTML5 2D Canvas API kullanılır. Matter.js, Box2D, Pixi.js veya Three.js gibi harici kütüphaneler dahil edilmez.
3. **Mikro Etkileşim Süresi (Micro-interaction):**
   Her bir atış döngüsü çekme, uçuş ve hedef tepkisi dahil 2-4 saniye sürer. Ziyaretçiyi siteden koparmadan hızlı bir tebessüm ve etkileşim sunar.
4. **Tak-Çalıştır Modülerlik (Plug-and-Play):**
   Tek satırlık başlatıcıyla çalışır: `new ArrowShot(options)`.

---

## 3. Oynanış Döngüsü ve Kullanıcı Akışı (Gameplay Loop)

```
[BEKLEME / DİNLENME MODU]
  │  (Fırlatıcı köşede hazır bekler, hafif nabız animasyonuyla davet eder)
  ▼
[GERME VE NİŞAN ALMA AŞAMASI]
  │  (Ok/Sapan üzerine basılı tutup geriye sürükleme)
  │  - Ters fırlatma vektörü hesaplanır
  │  - Dinamik gerilme ipi çizilir
  │  - Kesikli noktalarla tahmini uçuş yolu gösterilir
  ▼
[BIRAKMA VE UÇUŞ AŞAMASI]
  │  (Bırakıldığı anda başlangıç hızı V0 oka aktarılır)
  │  - Dikey yerçekimi ivmesiyle parabolik uçuş gerçekleşir
  │  - Ok ucu anlık hıza göre döner: atan2(Vy, Vx)
  │
  ├───> [ISKALAMA / EKRAN DIŞI]
  │       Ok zemine saplanır veya ekrandan çıkar -> 1.5 sn sonra kaybolur -> döngü sıfırlanır.
  │
  └───> [HEDEFİ VURMA]
          Çarpışma doğrulanır -> Vuruş tepkisi (sallantı + konfeti + yüzen skor yazısı)
          -> Skor güncellenir -> 1.5 sn sonra hazır konuma döner.
```

---

## 4. Fizik ve Matematiksel Modeller

Tüm birimler standart 60 FPS (`requestAnimationFrame`) üzerinden piksel ve kare başına değerlerdir.

### 4.1 Fırlatma Vektörü ve Sınırlandırma (Clamping)

* Başlangıç merkezi: $(x_0, y_0)$
* Fare/Dokunma konumu: $(x_p, y_p)$
* Ham yer değiştirme vektörü:
  $$\Delta x = x_0 - x_p, \quad \Delta y = y_0 - y_p$$
* Çekilme mesafesi:
  $$d = \sqrt{\Delta x^2 + \Delta y^2}$$
* Maksimum gerilme yarıçapı: $R_{\max} = 100\text{ px}$
* Eğer $d > R_{\max}$ ise vektör sınırlandırılır:
  $$\Delta x_{\text{clamped}} = \Delta x \cdot \frac{R_{\max}}{d}, \quad \Delta y_{\text{clamped}} = \Delta y \cdot \frac{R_{\max}}{d}$$
* Başlangıç fırlatma hızı:
  $$V_{0x} = \Delta x_{\text{clamped}} \cdot \text{powerMultiplier}$$
  $$V_{0y} = \Delta y_{\text{clamped}} \cdot \text{powerMultiplier}$$

### 4.2 Uçuş Entegrasyonu (Euler Yöntemi)

Her karede (frame) işletilen kurallar:
$$V_y \leftarrow V_y + g \quad (g \approx 0.38 - 0.45\text{ px/frame}^2)$$
$$V_x \leftarrow V_x \cdot \mu \quad (\mu = 0.998\text{ hava direnci})$$
$$x \leftarrow x + V_x$$
$$y \leftarrow y + V_y$$

### 4.3 Ok Açısı ve Dönüşü

Okun ucu uçuş yönüne teğet kalmalıdır:
$$\theta = \text{atan2}(V_y, V_x)$$

### 4.4 Yörünge Tahmini (Kesikli Çizgi Önizlemesi)

Kullanıcı oku gererken 15–20 adet örnekleme noktası hesaplanıp çizilir:
$$x(t) = x_0 + V_{0x} \cdot t$$
$$y(t) = y_0 + V_{0y} \cdot t + \frac{1}{2} g t^2$$
*(burada $t \in [3, 6, 9, \dots, 60]$ kare aralıklarıyla taranır)*.

### 4.5 Çarpışma ve Puanlama

* Hedef Tahtası: $(x_t, y_t)$ merkezinde ve $R_t$ yarıçapında dairedir.
* Ok Ucu: $(x_a, y_a)$ noktasal koordinatıdır.
* İsabet Koşulu:
  $$\sqrt{(x_a - x_t)^2 + (y_a - y_t)^2} \le R_t$$
* Puanlama Katmanları:
  * Mesafe $\le 0.33 \cdot R_t \implies 300\text{ puan}$ ("Tam 12'den!")
  * Mesafe $\le 0.66 \cdot R_t \implies 150\text{ puan}$
  * Mesafe $\le 1.00 \cdot R_t \implies 50\text{ puan}$

---

## 5. UI, Canvas ve DOM Mimarisi

### 5.1 Katman Düzeni

```html
<body>
  <!-- Web Sitesinin Kendi İçeriği -->
  <div id="main-site-content">...</div>

  <!-- ArrowShot Katmanı -->
  <canvas id="arrowshot-canvas" style="
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99999;
    pointer-events: none;
  "></canvas>
</body>
```

### 5.2 Olay (Event) Yönetim Stratejisi

* Canvas varsayılanda `pointer-events: none` kalarak alttaki buton ve linklerin tıklanmasını engellemez.
* Sapan/Yay merkezinde ufak bir tetikleyici alan tanımlanır. Kullanıcı fareyi buraya getirdiğinde (`pointermove`) veya dokunduğunda (`pointerdown`) canvas `pointer-events: auto` durumuna geçer; atış tamamlandığında veya iptal edildiğinde tekrar `none` moduna döner.

---

## 6. Görsel Efektler ve Geri Bildirim ("Juice")

1. **Dinamik Sapan Lastiği:** Sapanın sol ve sağ uçlarından okun arkasına uzanan 2 adet Bézier eğrisi.
2. **Vuruş Parçacıkları:** İsabet anında radyal biçimde fırlayan 20–30 adet renkli konfeti parçacığı (yerçekimi ve şeffaflaşma ile sönümlenir).
3. **Yüzen Skor Metni (Floating Text):** Vurulan noktadan yukarı doğru süzülerek kaybolan `+300` skoru.
4. **Hedef Titremesi (Elastic Shake):** Vurulan hedefin sinüs dalgası sönümüyle hafifçe geriye esneyip yerine oturması.

---

## 7. Önerilen Proje Dosya Yapısı

```
arrow-shot-widget/
├── index.html              # Bağımsız test ve demo sayfası
├── docs/
│   └── GDD.md              # Bu tasarım belgesi
└── src/
    ├── ArrowShot.js        # Ana giriş ve orkestrasyon sınıfı
    ├── core/
    │   ├── Physics.js      # Vektör matematiği, yerçekimi, yörünge tahmini
    │   └── Collision.js    # Daire/nokta çarpışması ve puan hesabı
    ├── entities/
    │   ├── Slingshot.js    # Sapan çatalı ve elastik lastik çizimi
    │   ├── Projectile.js   # Ok geometrisi, koordinat ve rotasyon
    │   └── Target.js       # Hedef tahtası ve esneme animasyonu
    ├── fx/
    │   ├── ParticleSystem.js # Konfeti ve kıvılcım efektleri
    │   └── ScorePopup.js     # Yükselen ve sönen skor yazıları
    └── utils/
        └── MathUtils.js    # clamp, lerp, mesafe yardımcı fonksiyonları
```

---

## 8. Konfigürasyon ve API Şeması

```javascript
const widget = new ArrowShot({
  mountTarget: document.body,
  bowPosition: 'bottom-left',      // 'bottom-left' | 'bottom-right' | { x, y }
  targetPosition: 'top-right',     // 'top-right' | 'top-left' | { x, y }
  gravity: 0.42,
  powerMultiplier: 0.22,
  maxDragRadius: 90,
  theme: {
    primaryColor: '#f59e0b',
    arrowColor: '#1e293b',
    targetRingColors: ['#ef4444', '#ffffff', '#3b82f6']
  },
  enableTrajectory: true,          // Yörünge tahmin noktaları
  enableSound: false,              // Web Audio API sentez sesleri
  onHit: (score, totalScore) => {
    console.log(`Hedef vuruldu! Skor: ${score} - Toplam: ${totalScore}`);
  },
  onMiss: () => {
    console.log('Iskalandı.');
  }
});
```

---

## 9. Otonom AI Agent İçin Görev Komutu (Prompt)

Projedeki yapay zeka aracına kodlamayı başlatması için verilecek doğrudan talimat:

```text
docs/GDD.md dosyasını eksiksiz oku. ArrowShot widget'ını belgede belirtilen fizik denklemlerine, sıfır dış kütüphane prensibine ve transparan Canvas katman mimarisine sadık kalarak saf Vanilla JavaScript (ES6+) ile modüler bir şekilde inşa et. Bölüm 7'de belirtilen dosya mimarisine uygun, çalışan kaynak kodları sırasıyla üret.
```
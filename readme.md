# VidiFusion Uygulaması

Bu proje, Electron ve Python kullanarak videoların oynatımını ve görüntü işleme uygulamalarını sunan bir masaüstü uygulamasıdır.

## Özellikler

- **Video Oynatma:** Yerel video dosyalarını seçip oynatabilir, aynı zamanda internet videolarını da açabilirsiniz.
- **Görüntü İşleme:** Videolara gerçek zamanlı olarak aşağıdaki işlemler uygulanabilir:
  - Kenar Tespiti
  - Hareket Telafisi
  - Renk İyileştirmesi
  - Derin Öğrenme Tabanlı İyileştirme
- **WebSocket İletişimi:** Python tabanlı görüntü işleme sunucusu ile web soket bağlantısı üzerinden gerçek zamanlı video işleme gerçekleştirilir.
- **Geliştirici Menüsü:** Geri/İleri, yeniden yükleme ve hata ayıklama seçenekleri menü üzerinden kolayca kullanılabilir.

## Yapı

```plaintext
├── main-playback.js
├── main.js
├── preload.js
├── package.json
├── readme.md
└── src
    ├── index.html
    ├── playback.html
    ├── renderer.js
    ├── server.py
    ├── styles/
    │   └── style.css
    ├── styles.css
    ├── url_input.html
    ├── videoController.js
    └── VidiFusion.html
```

- **main.js**

  Uygulamanın ana Electron sürecidir. Menüler ve pencere yönetimi burada yapılır.

- **main-playback.js**

  Video oynatma penceresini oluşturur.

- **preload.js**

  Güvenli context bridge aracılığıyla ön yüz ile ana süreç arasında iletişim sağlar.

- **server.py**

  Videolara uygulanan görüntü işleme algoritmalarını (örneğin kenar tespiti ve süper çözünürlük) içeren Python sunucusudur.

- **renderer.js**

  Video oynatma ve kontrolleri için ön uç JavaScript dosyasıdır.

## Kurulum

1. **Bağımlılıkların Yüklenmesi:**

   Electron'un yüklü olduğundan emin olun. Terminalde aşağıdaki komutu çalıştırın:

   ```sh
   npm install
   ```

2. **Uygulamayı Başlatma:**

   Uygulamayı Electron aracılığıyla başlatmak için:

   ```sh
   npm start
   ```

3. **Video Oynatma Penceresini Başlatma:**

   Seçilen video ile oynatma penceresini açmak için:

   ```sh
   npm run start-playback -- "video-dosya-yolu"
   ```

4. **Görüntü İşleme Sunucusunu Çalıştırma:**

   Python görüntü işleme sunucusunu başlatmak için:

   ```sh
   python src/server.py
   ```

## Kullanım

- **Video Seçimi:** Ana pencere (src/index.html) üzerinden yerel video dosyalarınızı seçebilir ve oynatabilirsiniz.
- **İnternet VidiFusionu:** Menü üzerinden URL girişi yaparak internet videolarını açabilirsiniz.
- **Görüntü İşleme Ayarları:**

playback.html

üzerinden farklı görüntü işleme algoritmalarını ve ek ayarları (örn. kenar tespiti, hareket telafisi) seçebilirsiniz.

## Notlar

- **package.json:** dosyasında Electron sürümü ve ilgili scriptler tanımlanmıştır.

- **Görüntü İşleme Ayarları:** `playback.html` üzerinden farklı görüntü işleme algoritmalarını ve ek ayarları (örn. kenar tespiti, hareket telafisi) seçebilirsiniz.

Bu README dosyası, projenizin kurulumu, yapısı ve nasıl çalıştırılacağı hakkında temel bilgileri sunar.- **package.json** dosyasında Electron sürümü ve ilgili scriptler tanımlanmıştır.
Bu README dosyası, projenizin kurulumu, yapısı ve nasıl çalıştırılacağı hakkında temel bilgileri sunar.

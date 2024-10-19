const { exec } = require("child_process");
const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");

// Creăm folderul 'temp' dacă nu există
const tempDir = path.resolve(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

app.get("/", (req, res) => {
  res.json("Watting for request");
});
app.get("/extract-audio", (req, res) => {
  const videoUrl = req.query.url;

  // Comanda pentru a extrage metadatele despre videoclip
  const metadataCommand = `yt-dlp --dump-json ${videoUrl}`;

  // Rulăm comanda pentru a extrage metadatele
  exec(metadataCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error fetching metadata: ${stderr}`);
      res.status(500).send("Error fetching metadata");
      return;
    }

    // Metadatele sunt returnate în stdout în format JSON
    let metadata;
    try {
      metadata = JSON.parse(stdout);
    } catch (parseError) {
      console.error(`Error parsing metadata: ${parseError}`);
      res.status(500).send("Error parsing metadata");
      return;
    }

    const title = metadata.title.replace(/[/\\?%*:|"<>]/g, ""); // Eliminăm caracterele nepermise în numele fișierului
    const audioPath = path.resolve(tempDir, `${title}.mp3`);

    // Comanda pentru a descărca doar fișierul audio
    const downloadCommand = `yt-dlp --extract-audio --audio-format mp3 -o "${audioPath}" ${videoUrl}`;

    exec(downloadCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error downloading audio: ${stderr}`);
        res.status(500).send("Error downloading audio");
        return;
      }

      // Verificăm dacă fișierul audio a fost creat
      if (fs.existsSync(audioPath)) {
        // Trimiterea fișierului audio împreună cu metadatele într-un răspuns JSON
        res.setHeader("Content-Type", "application/json");
        res.json({
          title: title,
          uploader: metadata.uploader,
          duration: metadata.duration,
          file: `/download-audio?file=${encodeURIComponent(title)}.mp3`,
        });
      } else {
        res.status(500).send("Audio file not found");
      }
    });
  });
});

// Endpoint separat pentru descărcarea efectivă a fișierului audio
app.get("/download-audio", (req, res) => {
  const filePath = path.resolve(tempDir, req.query.file);
  if (fs.existsSync(filePath)) {
    res.download(filePath, req.query.file, (err) => {
      if (err) {
        console.error(`Error sending audio file: ${err}`);
        res.status(500).send("Error sending audio file");
      }
    });
  } else {
    res.status(404).send("File not found");
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

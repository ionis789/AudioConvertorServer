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
  res.json("Waiting for request");
});

app.get("/extract-audio", (req, res) => {
  const videoUrl = req.query.url;

  const metadataCommand = `yt-dlp --dump-json ${videoUrl}`;
  exec(metadataCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error fetching metadata: ${stderr}`);
      res.status(500).send("Error fetching metadata");
      return;
    }

    let metadata;
    try {
      metadata = JSON.parse(stdout);
    } catch (parseError) {
      console.error(`Error parsing metadata: ${parseError}`);
      res.status(500).send("Error parsing metadata");
      return;
    }

    const title = metadata.title.replace(/[/\\?%*:|"<>]/g, "").trim(); // Eliminăm caracterele invalide
    const audioPath = path.resolve(tempDir, `${title}.mp3`);

    // Comanda pentru descărcarea fișierului audio cu metadate încorporate
    const downloadCommand = `yt-dlp --extract-audio --audio-format mp3 --embed-thumbnail --add-metadata -o "${audioPath}" ${videoUrl}`;
    exec(downloadCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error downloading audio: ${stderr}`);
        res.status(500).send("Error downloading audio");
        return;
      }

      if (fs.existsSync(audioPath)) {
        // Răspuns cu datele fișierului audio
        res.setHeader("Content-Type", "application/json");
        res.json({
          title: title,
          audio: `/download-audio?file=${encodeURIComponent(title)}.mp3`,
        });
      } else {
        res.status(500).send("Audio file not found");
      }
    });
  });
});

app.get("/download-audio", (req, res) => {
  const filePath = path.resolve(tempDir, req.query.file);
  if (fs.existsSync(filePath)) {
    const safeFilename = req.query.file.replace(/[^a-zA-Z0-9.\-_]/g, "_"); // Eliminăm caracterele invalide din numele fișierului
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.download(filePath, safeFilename, (err) => {
      if (err) {
        console.error(`Error sending audio file: ${err}`);
        res.status(500).send("Error sending audio file");
      }
    });
  } else {
    res.status(404).send("File not found");
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log("Server running on 0.0.0.0:3000");
});
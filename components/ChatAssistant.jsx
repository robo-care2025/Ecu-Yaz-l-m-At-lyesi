"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_IMAGES, MAX_MESSAGES, MAX_TEXT_LENGTH } from "@/lib/chat-limits";

const GREETING =
  "Merhaba! Ben ECU Yazılım Atölyesi'nin ön teşhis asistanıyım. Scooter / bisiklet bataryası veya ECU arızanızı anlatın, isterseniz fotoğraf da ekleyin.";

// Fotoğrafı en uzun kenarı 1024 px olacak şekilde küçültüp JPEG'e çevirir
function resizeImage(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const preview = canvas.toDataURL("image/jpeg", 0.8);
      resolve({ media_type: "image/jpeg", data: preview.split(",")[1], preview });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Fotoğraf okunamadı. Lütfen JPG veya PNG formatında bir fotoğraf seçin."));
    };
    img.src = url;
  });
}

// Sunucuya sadece metin ve fotoğraf verisi gider, önizleme görüntüsü gitmez
function toPayload(messages) {
  return messages.map(({ role, text, image }) => ({
    role,
    text,
    ...(image && { image: { media_type: image.media_type, data: image.data } }),
  }));
}

async function callAssistant(body) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Bir hata oluştu, lütfen tekrar deneyin.");
  return data.reply;
}

export default function ChatAssistant({ open, onOpenChange, whatsappNumber }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [handoffText, setHandoffText] = useState("");
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const imageCount = messages.filter((m) => m.image).length;
  const limitReached = messages.length >= MAX_MESSAGES - 1;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, handoffText, open]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await resizeImage(file));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (loading || limitReached || (!text && !image)) return;

    const previous = messages;
    const next = [...messages, { role: "user", text, image }];
    setMessages(next);
    setInput("");
    setImage(null);
    setError("");
    setHandoffText("");
    setLoading(true);
    try {
      const reply = await callAssistant({ messages: toPayload(next) });
      setMessages([...next, { role: "assistant", text: reply }]);
    } catch (err) {
      // Mesaj gitmediyse müşteri tekrar deneyebilsin diye eski hâline döndür
      setMessages(previous);
      setInput(text);
      setImage(image);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Konuşmanın özetini hazırlar; müşteri özeti görüp WhatsApp bağlantısına kendisi tıklar
  const prepareHandoff = async () => {
    if (loading || messages.length === 0) return;
    setLoading(true);
    setError("");
    let summary;
    try {
      summary = await callAssistant({ messages: toPayload(messages), mode: "summary" });
    } catch {
      // Özet alınamazsa müşterinin kendi yazdıklarını gönder
      summary = messages
        .filter((m) => m.role === "user" && m.text)
        .map((m) => m.text)
        .join("\n");
    } finally {
      setLoading(false);
    }
    const photoNote = imageCount > 0 ? "\n\nFotoğrafları bu sohbete ekliyorum." : "";
    setHandoffText(`Merhaba, sitenizdeki asistanla ön teşhis yaptım.\n\n${summary}${photoNote}`);
  };

  if (!open) {
    return (
      <Button
        onClick={() => onOpenChange(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-orange-500 px-5 py-3 text-base shadow-lg hover:bg-orange-600"
      >
        💬 Yapay Zekâ Asistanı
      </Button>
    );
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex h-[75vh] max-h-[640px] flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-950 text-white shadow-2xl sm:left-auto sm:w-96">
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div>
          <p className="font-semibold text-orange-400">Ön Teşhis Asistanı</p>
          <p className="text-xs text-gray-400">Fiyat ve kesin teşhis teknisyenimizden</p>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Asistanı kapat"
          className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Mesajlar */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="max-w-[85%] rounded-lg bg-gray-800 px-3 py-2 text-sm">{GREETING}</div>
        {messages.map((message, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              message.role === "user" ? "ml-auto bg-orange-500" : "bg-gray-800"
            }`}
          >
            {message.image && (
              <img src={message.image.preview} alt="Gönderilen fotoğraf" className="mb-2 max-h-40 rounded" />
            )}
            {message.text}
          </div>
        ))}
        {loading && <div className="max-w-[85%] rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-400">Asistan yazıyor…</div>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {handoffText && (
          <div className="space-y-3 rounded-lg border border-green-600 bg-gray-900 p-3 text-sm">
            <p className="font-semibold text-green-400">Teknisyenimize gidecek mesaj hazır:</p>
            <p className="whitespace-pre-wrap text-gray-300">{handoffText}</p>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(handoffText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md bg-green-600 px-4 py-2 text-center font-medium hover:bg-green-700"
            >
              WhatsApp'ta Gönder
            </a>
          </div>
        )}
        {limitReached && (
          <p className="text-sm text-gray-400">Konuşma uzunluk sınırına ulaştı. Devam etmek için WhatsApp'a aktarın.</p>
        )}
      </div>

      {/* Mesaj yazma alanı */}
      <div className="space-y-2 border-t border-gray-800 p-3">
        {image && (
          <div className="relative inline-block">
            <img src={image.preview} alt="Eklenecek fotoğraf" className="h-16 rounded" />
            <button
              onClick={() => setImage(null)}
              aria-label="Fotoğrafı kaldır"
              className="absolute -right-2 -top-2 h-5 w-5 cursor-pointer rounded-full bg-gray-700 text-xs leading-5"
            >
              ✕
            </button>
          </div>
        )}
        <form onSubmit={send} className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading || limitReached || imageCount >= MAX_IMAGES || Boolean(image)}
            aria-label="Fotoğraf ekle"
            title={imageCount >= MAX_IMAGES ? `En fazla ${MAX_IMAGES} fotoğraf gönderebilirsiniz` : "Fotoğraf ekle"}
            className="cursor-pointer rounded-md bg-gray-800 px-3 text-lg hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            📷
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_TEXT_LENGTH}
            disabled={limitReached}
            placeholder="Arızayı yazın…"
            className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-base sm:text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <Button type="submit" disabled={loading || limitReached || (!input.trim() && !image)} className="bg-orange-500 hover:bg-orange-600">
            Gönder
          </Button>
        </form>
        <button
          onClick={prepareHandoff}
          disabled={loading || messages.length === 0}
          className="w-full cursor-pointer rounded-md border border-green-600 py-2 text-sm text-green-400 hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          WhatsApp'a Aktar
        </button>
        <p className="text-center text-xs text-gray-500">Yapay zekâ hata yapabilir. Kesin teşhis atölyede yapılır.</p>
      </div>
    </div>
  );
}

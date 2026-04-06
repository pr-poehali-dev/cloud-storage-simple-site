import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/b7d170e8-40e4-4890-b516-56d6804089f6";

interface FileItem {
  key: string;
  name: string;
  size: number;
  last_modified: string;
  url: string;
}

type View = "home" | "storage";
type DisplayMode = "grid" | "list";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "avi"];
const DOC_EXTS = ["pdf", "doc", "docx", "txt", "xls", "xlsx", "ppt", "pptx"];

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isImage(name: string) {
  return IMAGE_EXTS.includes(getExt(name));
}

function isVideo(name: string) {
  return VIDEO_EXTS.includes(getExt(name));
}

type IconName = "Image" | "Video" | "Music" | "FileText" | "Archive" | "Code" | "File";

function getFileIcon(name: string): IconName {
  const ext = getExt(name);
  if (IMAGE_EXTS.includes(ext)) return "Image";
  if (VIDEO_EXTS.includes(ext)) return "Video";
  if (["mp3", "wav", "flac", "ogg"].includes(ext)) return "Music";
  if (DOC_EXTS.includes(ext)) return "FileText";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "Archive";
  if (["js", "ts", "py", "html", "css", "json"].includes(ext)) return "Code";
  return "File";
}

function getFileColor(name: string) {
  const ext = getExt(name);
  if (IMAGE_EXTS.includes(ext)) return "text-pink-400";
  if (VIDEO_EXTS.includes(ext)) return "text-orange-400";
  if (["mp3", "wav", "flac"].includes(ext)) return "text-green-400";
  if (DOC_EXTS.includes(ext)) return "text-blue-400";
  if (["zip", "rar", "7z"].includes(ext)) return "text-yellow-400";
  return "text-purple-400";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function Index() {
  const [view, setView] = useState<View>("home");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("grid");
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setFiles(data.files || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "storage") fetchFiles();
  }, [view, fetchFiles]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(`Загружаю: ${file.name}`);
    try {
      const reader = new FileReader();
      const fileData: string = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_data: fileData,
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
        }),
      });
      await fetchFiles();
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFiles = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      await uploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const deleteFile = async (key: string) => {
    setDeletingKey(key);
    try {
      await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      setFiles((prev) => prev.filter((f) => f.key !== key));
      if (previewFile?.key === key) setPreviewFile(null);
    } finally {
      setDeletingKey(null);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="min-h-screen bg-background font-golos">
      {/* Background */}
      <div className="fixed inset-0 bg-grid opacity-50 pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 glass border-b border-white/5 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => setView("home")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center animate-pulse-glow">
              <Icon name="Cloud" size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">CloudDrop</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("home")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === "home"
                  ? "bg-purple-500/20 text-purple-300 neon-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Главная
            </button>
            <button
              onClick={() => setView("storage")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === "storage"
                  ? "bg-purple-500/20 text-purple-300 neon-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Хранилище
            </button>
          </div>
        </div>
      </nav>

      {/* Home */}
      {view === "home" && (
        <main className="relative z-10">
          <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
            <div className="animate-fade-in stagger-1">
              <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-muted-foreground mb-8 border border-purple-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Быстрое и безопасное облачное хранилище
              </div>
            </div>
            <h1 className="text-7xl font-black mb-6 leading-tight animate-fade-in stagger-2">
              Храните всё{" "}
              <span className="gradient-text neon-text">в облаке</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in stagger-3">
              Загружайте файлы и фото, делитесь ссылками с кем угодно.
              Поддержка русских названий, мгновенный просмотр.
            </p>
            <div className="flex items-center justify-center gap-4 animate-fade-in stagger-4">
              <button
                onClick={() => setView("storage")}
                className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold text-lg hover:from-purple-500 hover:to-purple-400 transition-all shadow-lg hover:shadow-purple-500/30 hover:scale-105"
              >
                <Icon name="Upload" size={20} />
                Открыть хранилище
                <Icon name="ArrowRight" size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="mt-20 flex justify-center animate-float">
              <div className="relative">
                <div className="w-64 h-64 rounded-3xl glass neon-border flex items-center justify-center">
                  <div className="text-center">
                    <Icon name="Cloud" size={64} className="text-purple-400 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Ваше хранилище</p>
                  </div>
                </div>
                <div className="absolute -top-4 -right-8 glass rounded-2xl px-4 py-2 flex items-center gap-2 border border-green-500/20 animate-fade-in stagger-5">
                  <Icon name="CheckCircle" size={16} className="text-green-400" />
                  <span className="text-xs text-green-300 font-medium">Файл загружен!</span>
                </div>
                <div className="absolute -bottom-4 -left-8 glass rounded-2xl px-4 py-2 flex items-center gap-2 border border-cyan-500/20 animate-fade-in stagger-5">
                  <Icon name="Eye" size={16} className="text-cyan-400" />
                  <span className="text-xs text-cyan-300 font-medium">Просмотр для всех</span>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-7xl mx-auto px-6 pb-24">
            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  icon: "Upload",
                  color: "text-purple-400",
                  bg: "from-purple-500/10 to-purple-600/5",
                  border: "border-purple-500/20",
                  title: "Быстрая загрузка",
                  desc: "Перетащите файлы или выберите вручную. Русские названия сохраняются без искажений.",
                },
                {
                  icon: "Globe",
                  color: "text-cyan-400",
                  bg: "from-cyan-500/10 to-cyan-600/5",
                  border: "border-cyan-500/20",
                  title: "Доступ для всех",
                  desc: "Любой посетитель может просмотреть загруженные файлы и скачать их.",
                },
                {
                  icon: "Trash2",
                  color: "text-pink-400",
                  bg: "from-pink-500/10 to-pink-600/5",
                  border: "border-pink-500/20",
                  title: "Управление",
                  desc: "Удаляйте ненужные файлы одним нажатием, освобождая место в хранилище.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className={`glass rounded-2xl p-8 border ${f.border} glass-hover animate-fade-in`}
                  style={{ animationDelay: `${0.2 + i * 0.1}s`, opacity: 0 }}
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${f.bg} mb-5`}>
                    <Icon name={f.icon} size={28} className={f.color} />
                  </div>
                  <h3 className="font-bold text-xl mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* Storage */}
      {view === "storage" && (
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <div>
              <h1 className="text-4xl font-black gradient-text mb-1">Хранилище</h1>
              <p className="text-muted-foreground text-sm">
                {files.length} файлов · {formatSize(totalSize)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDisplayMode(displayMode === "grid" ? "list" : "grid")}
                className="glass px-4 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground transition-all hover:border-purple-500/40"
              >
                <Icon name={displayMode === "grid" ? "List" : "LayoutGrid"} size={18} />
              </button>
              <button
                onClick={() => fetchFiles()}
                className="glass px-4 py-2.5 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground transition-all hover:border-purple-500/40"
              >
                <Icon name="RefreshCw" size={18} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold hover:from-purple-500 hover:to-purple-400 transition-all hover:scale-105 disabled:opacity-50"
              >
                <Icon name={uploading ? "Loader" : "Upload"} size={18} className={uploading ? "animate-spin" : ""} />
                {uploading ? (uploadProgress || "Загрузка...") : "Загрузить"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          </div>

          <div className="relative mb-6 animate-fade-in stagger-1">
            <Icon name="Search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-muted-foreground bg-transparent"
            />
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`upload-zone rounded-2xl p-8 text-center cursor-pointer mb-8 animate-fade-in stagger-2 ${dragOver ? "drag-over" : ""}`}
          >
            <Icon name="CloudUpload" size={40} className="text-purple-400 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Перетащите файлы сюда или{" "}
              <span className="text-purple-400 font-medium">нажмите для выбора</span>
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">Любые типы файлов · Русские названия поддерживаются</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
              <p className="text-muted-foreground">Загружаю файлы...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
              <div className="w-20 h-20 rounded-2xl glass border border-white/5 flex items-center justify-center">
                <Icon name="FolderOpen" size={36} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {searchQuery ? "Ничего не найдено" : "Хранилище пустое — загрузите первый файл"}
              </p>
            </div>
          ) : displayMode === "grid" ? (
            <div className="grid grid-cols-4 gap-4">
              {filteredFiles.map((file, i) => (
                <FileCard
                  key={file.key}
                  file={file}
                  index={i}
                  onPreview={() => setPreviewFile(file)}
                  onDelete={() => deleteFile(file.key)}
                  deleting={deletingKey === file.key}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredFiles.map((file, i) => (
                <FileRow
                  key={file.key}
                  file={file}
                  index={i}
                  onPreview={() => setPreviewFile(file)}
                  onDelete={() => deleteFile(file.key)}
                  deleting={deletingKey === file.key}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-scale-in"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="glass neon-border rounded-3xl max-w-4xl w-full mx-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Icon name={getFileIcon(previewFile.name)} size={20} className={getFileColor(previewFile.name)} />
                <span className="font-semibold truncate max-w-md">{previewFile.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(previewFile.size)}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-sm text-cyan-400 hover:border-cyan-500/40 transition-all"
                >
                  <Icon name="Download" size={16} />
                  Скачать
                </a>
                <button
                  onClick={() => deleteFile(previewFile.key)}
                  className="px-3 py-2 rounded-xl glass border border-red-500/20 text-sm text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all"
                >
                  <Icon name="Trash2" size={16} />
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="w-9 h-9 rounded-xl glass border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                >
                  <Icon name="X" size={18} />
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[70vh] overflow-auto flex items-center justify-center">
              {isImage(previewFile.name) ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[60vh] object-contain rounded-xl"
                />
              ) : isVideo(previewFile.name) ? (
                <video
                  src={previewFile.url}
                  controls
                  className="max-w-full max-h-[60vh] rounded-xl"
                />
              ) : (
                <div className="text-center py-16">
                  <Icon name={getFileIcon(previewFile.name)} size={64} className={`${getFileColor(previewFile.name)} mx-auto mb-4`} />
                  <p className="text-muted-foreground mb-6">Предпросмотр недоступен для этого типа файла</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium hover:from-purple-500 hover:to-purple-400 transition-all"
                  >
                    <Icon name="Download" size={18} />
                    Открыть / Скачать
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileCard({
  file, index, onPreview, onDelete, deleting,
}: {
  file: FileItem;
  index: number;
  onPreview: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div
      className="glass glass-hover rounded-2xl overflow-hidden border border-white/5 animate-fade-in group"
      style={{ animationDelay: `${index * 0.04}s`, opacity: 0 }}
    >
      <div
        className="h-40 flex items-center justify-center cursor-pointer relative overflow-hidden bg-gradient-to-br from-white/2 to-white/0"
        onClick={onPreview}
      >
        {isImage(file.name) ? (
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon name={getFileIcon(file.name)} size={48} className={getFileColor(file.name)} />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
              {file.name.split(".").pop()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-10 h-10 rounded-full glass border border-white/20 flex items-center justify-center">
            <Icon name="Eye" size={18} className="text-white" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm font-medium truncate mb-1" title={file.name}>{file.name}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
          <div className="flex items-center gap-1">
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-cyan-400 transition-colors"
            >
              <Icon name="Download" size={14} />
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={deleting}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <Icon name={deleting ? "Loader" : "Trash2"} size={14} className={deleting ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file, index, onPreview, onDelete, deleting,
}: {
  file: FileItem;
  index: number;
  onPreview: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div
      className="glass glass-hover rounded-xl p-4 flex items-center gap-4 border border-white/5 animate-fade-in group cursor-pointer"
      style={{ animationDelay: `${index * 0.03}s`, opacity: 0 }}
      onClick={onPreview}
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center shrink-0">
        <Icon name={getFileIcon(file.name)} size={22} className={getFileColor(file.name)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatDate(file.last_modified)}</p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">{formatSize(file.size)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-cyan-400 transition-colors"
        >
          <Icon name="Download" size={16} />
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
        >
          <Icon name={deleting ? "Loader" : "Trash2"} size={16} className={deleting ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
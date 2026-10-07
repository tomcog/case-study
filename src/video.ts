export function isVideoSrc(src: string): boolean {
  return /\.mp4$/i.test(src);
}

export function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  let match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  match = trimmed.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;
  return null;
}

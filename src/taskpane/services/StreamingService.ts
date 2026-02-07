export class StreamingService {
  private baseUrl = process.env.BACKEND_URL || "http://localhost:4000";

  streamOutline(topic: string, onChunk: (text: string) => void, onEnd: () => void) {
    const url = `${this.baseUrl}/stream/outline-stream?topic=${encodeURIComponent(topic)}`;
    const es = new EventSource(url);

    es.onmessage = (event) => {
      onChunk(event.data);
    };

    es.addEventListener("end", () => {
      es.close();
      onEnd();
    });

    es.onerror = () => {
      es.close();
      onEnd();
    };

    return () => es.close();
  }
}

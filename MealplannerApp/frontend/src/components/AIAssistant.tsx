import { useState, useRef, useEffect } from 'react';
import { getSuggestion } from '../services/mealService';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface Props {
  onClose: () => void;
}

export default function AIAssistant({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hallo! Ik ben jouw persoonlijke voedingscoach 🥗. Stel me een vraag over maaltijden, voeding of jouw doelen!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const { data } = await getSuggestion(question);
      setMessages((prev) => [...prev, { role: 'ai', text: data.antwoord }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Er is een fout opgetreden. Probeer het opnieuw.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden" style={{ height: '520px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg">🤖</div>
          <div>
            <p className="text-white font-semibold text-sm">AI Voedingscoach</p>
            <p className="text-green-100 text-xs">Powered by Gemini AI</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
        {['Wat kan ik eten?', 'Gezond ontbijt?', 'Mijn macros?'].map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); }}
            className="whitespace-nowrap text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 hover:bg-green-100 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 pb-3">
        <div className="flex gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Stel een vraag..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

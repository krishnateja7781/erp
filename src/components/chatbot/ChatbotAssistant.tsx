
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chatbot } from '@/ai/flows/chatbot-flow';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface UserProps {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
}

interface ChatbotAssistantProps {
  user: UserProps;
}

export function ChatbotAssistant({ user }: ChatbotAssistantProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const suggestionChips = {
      student: ["What's my attendance?", "When is my next exam?", "Explain the Krebs cycle"],
      teacher: ["What are my pending tasks?", "Help me write a welcome speech", "Explain Object-Oriented Programming"],
      admin: ["How many students are enrolled?", "Summarize overall attendance", "What's the fee balance for student ENG23CS0001?"]
  }

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 100);
    }
  }, [messages]);
  
  React.useEffect(() => {
    if (isOpen && messages.length === 0) {
        setMessages([{ role: 'bot', content: `Hello ${user.name}! I'm your AI assistant. How can I help you today?` }]);
    }
  }, [isOpen, user, messages.length]);


  const handleSubmit = async (e: React.FormEvent, query?: string) => {
    e.preventDefault();
    const userMessage = query || input;
    if (!userMessage.trim()) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Prepare history for the AI flow. The first message is the initial bot greeting, so we skip it.
    const historyForBackend = newMessages.slice(1, -1);

    try {
      const response = await chatbot({ 
          userId: user.id, 
          userRole: user.role, 
          query: userMessage,
          history: historyForBackend
      });

      setMessages(prev => [...prev, { role: 'bot', content: response.answer }]);
    } catch (err: any) {
      console.error("Chatbot error:", err);
      toast({ variant: 'destructive', title: 'AI Assistant Error', description: "Sorry, I couldn't get a response. Please try again." });
      setMessages(prev => [...prev, { role: 'bot', content: "I'm having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(true)}
      >
        <Bot className="h-7 w-7" />
        <span className="sr-only">Open AI Assistant</span>
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/> AI Assistant</SheetTitle>
            <SheetDescription>Your personal guide to the ERP.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="p-4 space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : '')}>
                  {message.role === 'bot' && <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0"><Bot className="h-5 w-5"/></div>}
                  <div className={cn("p-3 rounded-lg max-w-xs", message.role === 'bot' ? 'bg-muted' : 'bg-primary text-primary-foreground')}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'user' && <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><User className="h-5 w-5"/></div>}
                </div>
              ))}
              {isLoading && (
                 <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0"><Bot className="h-5 w-5"/></div>
                    <div className="p-3 rounded-lg bg-muted"><Loader2 className="h-5 w-5 animate-spin"/></div>
                 </div>
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="p-4 border-t flex flex-col">
            <div className="flex flex-wrap gap-2 mb-2 w-full">
                {suggestionChips[user.role].map(suggestion => (
                    <Button key={suggestion} size="sm" variant="outline" onClick={(e) => handleSubmit(e, suggestion)} disabled={isLoading}>
                        {suggestion}
                    </Button>
                ))}
            </div>
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

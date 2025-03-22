document.addEventListener("DOMContentLoaded", function() {
 "use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import JSZip from "jszip";

function MainComponent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [processingFeedback, setProcessingFeedback] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pinnedChats, setPinnedChats] = useState([]);
  const chatContainerRef = useRef(null);
  const [draftTimeout, setDraftTimeout] = useState(null);
  const [error, setError] = useState(null);
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);
  const copyToClipboard = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy code");
    }
  };
  const runCode = (code) => {
    try {
      const safeEval = new Function(code);
      const result = safeEval();
      return String(result);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  };
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setIsSidebarOpen(false);
  };
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };
  const handleLoadChat = (chat) => {
    setMessages(chat.messages);
    setIsSidebarOpen(false);
  };
  const handleSaveChat = async () => {
    try {
      await fetch("/api/ai-brain", {
        method: "POST",
        body: JSON.stringify({
          action: "addTags",
          context: {
            chatSessionId: Date.now().toString(),
            tags: selectedTags,
          },
        }),
      });
      toast.success("Chat saved successfully!");
    } catch (error) {
      toast.error("Failed to save chat");
    }
  };
  const toggleFavorite = async (chatId) => {
    try {
      await fetch("/api/ai-brain", {
        method: "POST",
        body: JSON.stringify({
          action: "toggleFavorite",
          context: { chatSessionId: chatId },
        }),
      });
      setChatHistory((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, isFavorite: !chat.isFavorite }
              : chat
          ),
        }))
      );
    } catch (error) {
      toast.error("Failed to update favorite status");
    }
  };
  const shareChat = async (chat) => {
    try {
      const shareData = {
        title: "PeaksAIG Chat",
        text: chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
        url: window.location.href,
      };
      await navigator.share(shareData);
    } catch (error) {
      toast.error("Failed to share chat");
    }
  };
  const exportChat = (chat) => {
    const blob = new Blob([JSON.stringify(chat.messages, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${chat.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (input) {
      localStorage.setItem("chatDraft", input);
    }
  }, [input]);

  useEffect(() => {
    const draft = localStorage.getItem("chatDraft");
    if (draft) setInput(draft);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSidebarOpen(true);
        document.getElementById("search-input")?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveChat();
      } else if (e.key === "Escape") {
        setInput("");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const now = new Date();
      const chatTitle = messages[0].content.slice(0, 30) + "...";

      setChatHistory((prev) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const isToday = (date) => {
          return date.toDateString() === today.toDateString();
        };
        const isYesterday = (date) => {
          return date.toDateString() === yesterday.toDateString();
        };
        const getDateGroup = (date) => {
          if (isToday(date)) return "Today";
          if (isYesterday(date)) return "Yesterday";

          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);

          if (date > weekAgo) {
            return "Last Week";
          }
          return "Older";
        };
        const newHistory = [...prev];
        const dateGroup = getDateGroup(now);
        const existingGroup = newHistory.find((g) => g.title === dateGroup);
        const chat = {
          id: Date.now(),
          title: chatTitle,
          time: now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          date: now,
          messages: [...messages],
        };

        if (existingGroup) {
          existingGroup.chats = [chat, ...existingGroup.chats];
        } else {
          newHistory.unshift({
            title: dateGroup,
            chats: [chat],
          });
        }

        return newHistory.sort((a, b) => {
          const order = ["Today", "Yesterday", "Last Week", "Older"];
          return order.indexOf(a.title) - order.indexOf(b.title);
        });
      });
    }
  }, [messages]);

  useEffect(() => {
    if (loading) {
      const feedbackMessages = [
        "🧠 Thinking...",
        "💭 Processing...",
        "⚡ Almost there...",
        "🎯 Fine-tuning...",
      ];
      let i = 0;
      const interval = setInterval(() => {
        setProcessingFeedback(feedbackMessages[i % feedbackMessages.length]);
        i++;
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    setMessages([]);

    const loadChatStatistics = async () => {
      try {
        const response = await fetch("/api/ai-brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getStatistics" }),
        });

        if (!response.ok) throw new Error("Failed to load statistics");

        const data = await response.json();
        setStatistics(data.statistics);
      } catch (error) {
        console.error("Failed to load statistics:", error);
      }
    };

    loadChatStatistics();
  }, []);

  const formatMessage = (message) => {
    if (message.type === "error") return message.content;
    return message.role === "assistant"
      ? "🤖 " + message.content
      : "👤 " + message.content;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const imageKeywords = [
        "generate image",
        "create image",
        "make image",
        "draw",
        "generate a picture",
        "create a picture",
        "make a picture",
        "show me",
        "visualize",
        "imagine",
        "generate art",
        "create art",
        "make art",
        "picture of",
        "image of",
      ];
      const creatorKeywords = [
        "who made you",
        "who created you",
        "who built you",
        "who developed you",
        "who owns you",
        "who programmed you",
      ];

      if (
        imageKeywords.some((keyword) => input.toLowerCase().includes(keyword))
      ) {
        const response = await fetch(
          `/integrations/dall-e-3/?prompt=${encodeURIComponent(input)}`
        );

        if (!response.ok) {
          throw new Error("Failed to generate image");
        }

        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.data[0],
            type: "image",
          },
        ]);
      } else if (
        creatorKeywords.some((keyword) => input.toLowerCase().includes(keyword))
      ) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I was created by Viraaj Singh.",
          },
        ]);
      } else {
        const response = await fetch(
          "/integrations/chat-gpt/conversationgpt4",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                {
                  role: "system",
                  content:
                    "You are PeaksAIG, a highly capable AI assistant that can help with chat and generate images. For image generation, guide users to ask using phrases like 'generate an image of...' or 'create a picture of...'. Be helpful and direct in your responses.",
                },
                ...messages.slice(-10),
                userMessage,
              ],
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.choices[0].message.content,
          },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble responding. Please try again.",
          type: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  const generateDownloadContent = (code, fileName) => {
    const blob = new Blob([code], { type: "text/javascript" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const generateZipDownload = async (files) => {
    const zip = new JSZip();
    files.forEach((file) => {
      zip.file(file.name, file.content);
    });
    const content = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.zip";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#1A1B1E] font-inter">
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 text-gray-400 hover:text-[#00F0FF] p-2 rounded-lg transition-colors duration-200"
      >
        <i className={`fas ${isSidebarOpen ? "fa-times" : "fa-bars"}`}></i>
      </button>
      <div
        className={`fixed inset-y-0 left-0 w-80 bg-[#1A1B1E] border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } z-40`}
      >
        <div className="flex flex-col h-full pt-16">
          <div className="px-4 space-y-4">
            <div className="relative">
              <input
                id="search-input"
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#2A2B2E] text-white px-4 py-2 rounded-lg pl-10"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>

            {statistics && (
              <div className="bg-[#2A2B2E] p-4 rounded-lg text-sm">
                <h3 className="text-[#00F0FF] mb-2 font-medium">Statistics</h3>
                <div className="space-y-2 text-gray-300">
                  <p>Total Chats: {statistics.total_chats}</p>
                  <p>Messages: {statistics.total_messages}</p>
                  <p>Active Days: {statistics.active_days}</p>
                </div>
                <div className="mt-3">
                  <p className="text-[#00F0FF] mb-1">Common Topics:</p>
                  <div className="flex flex-wrap gap-2">
                    {statistics.all_tags?.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-[#1A1B1E] rounded text-xs text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 mt-4">
            {pinnedChats.length > 0 && (
              <div className="mb-6">
                <div className="text-sm text-[#00F0FF] mb-2 font-medium">
                  Pinned
                </div>
                {pinnedChats.map((chat) => (
                  <></>
                ))}
              </div>
            )}

            {chatHistory
              .filter((group) =>
                group.chats.some(
                  (chat) =>
                    chat.title
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) &&
                    (!selectedTags.length ||
                      selectedTags.every((tag) => chat.tags?.includes(tag)))
                )
              )
              .map((group) => (
                <div key={group.title} className="mb-6">
                  <div className="text-sm text-[#00F0FF] mb-2 font-medium">
                    {group.title}
                  </div>
                  {group.chats.map((chat) => (
                    <div key={chat.id} className="relative group mb-2">
                      <button
                        onClick={() => handleLoadChat(chat)}
                        className="w-full text-left p-3 rounded-lg bg-[#2A2B2E] hover:bg-[#3A3B3E] text-white transition-colors"
                      >
                        <div className="text-sm truncate pr-20">
                          {chat.title}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                          <i className="fas fa-clock text-[10px]"></i>
                          {chat.time}
                          {group.title === "Last Week" && (
                            <span className="text-gray-500">
                              {chat.date.toLocaleDateString("en-US", {
                                weekday: "short",
                              })}
                            </span>
                          )}
                        </div>
                        {chat.tags && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {chat.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-[#1A1B1E] rounded-full text-xs text-gray-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>

                      <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(chat.id);
                          }}
                          className="p-1.5 rounded-full hover:bg-[#1A1B1E] text-gray-400 hover:text-[#00F0FF]"
                        >
                          <i
                            className={`fas fa-star ${
                              chat.isFavorite ? "text-[#00F0FF]" : ""
                            }`}
                          ></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareChat(chat);
                          }}
                          className="p-1.5 rounded-full hover:bg-[#1A1B1E] text-gray-400 hover:text-[#00F0FF]"
                        >
                          <i className="fas fa-share"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportChat(chat);
                          }}
                          className="p-1.5 rounded-full hover:bg-[#1A1B1E] text-gray-400 hover:text-[#00F0FF]"
                        >
                          <i className="fas fa-download"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div
          className="flex-1 overflow-y-auto px-4 md:px-6"
          ref={chatContainerRef}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-[slideIn_0.3s_ease-out]">
              <div className="relative w-24 h-24 animate-[pulse_2s_ease-in-out_infinite]">
                <img
                  src="/logo-peaksaig.png"
                  alt="PeaksAIG AI Logo"
                  className="w-24 h-24"
                />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-3xl md:text-4xl text-[#FFFFFF] font-light tracking-wide">
                  PeaksAIG
                </h1>
                <p className="text-xl md:text-2xl text-[#9CA3AF]">
                  How may I help you?
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl pt-4 space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  } animate-[slideIn_0.3s_ease-out]`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[75%]`}
  );
}

export default MainComponent;

    // You provided a large script earlier. Paste it entirely in here.
});

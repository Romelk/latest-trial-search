"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Sparkles, ChevronDown, X, Loader2, Pin, PinOff, Copy, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import demoQueries from "@/data/demo-queries.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Provider = "openai" | "anthropic";
type Product = {
  id: string;
  title: string;
  brand: string;
  price: number;
  imageUrl: string;
  category: string;
  color: string;
  reasons?: string[];
};

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
};

type SearchSession = {
  originalQuery: string;
  asked: boolean;
};

type CartItem = {
  id: string;
  title: string;
  brand: string;
  price: number;
  imageUrl: string;
  category: string;
  color: string;
  why: string;
};

type Cart = {
  name: string;
  items: CartItem[];
  notes: string[];
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [constraints, setConstraints] = useState<Record<string, string | number | null>>({});
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [session, setSession] = useState<SearchSession | null>(null);
  const [assistantQuestion, setAssistantQuestion] = useState<string | null>(null);
  const [cartsDialogOpen, setCartsDialogOpen] = useState(false);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [isBuildingCarts, setIsBuildingCarts] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareProducts, setCompareProducts] = useState<Product[]>([]);
  const [shoppingBrief, setShoppingBrief] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [originalQuery, setOriginalQuery] = useState("");
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productInsight, setProductInsight] = useState<any>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [compareVerdict, setCompareVerdict] = useState<any>(null);
  const [isLoadingVerdict, setIsLoadingVerdict] = useState(false);

  // Handle follow-up refinement
  const handleFollowUp = async (followUpText: string) => {
    if (!followUpText.trim() || !session || isLoading) return;

    setIsLoading(true);
    const previousConstraints = { ...constraints };

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: session.originalQuery,
          provider: provider === "openai" ? "openai" : "anthropic",
          session: session,
          followUp: followUpText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
      const newConstraints = data.constraints || {};
      
      // Show toast if constraints changed
      const constraintsChanged = JSON.stringify(previousConstraints) !== JSON.stringify(newConstraints);
      if (constraintsChanged) {
        toast.success("Applied", { duration: 2000 });
      }
      
      setConstraints(newConstraints);
      setSession(data.session || session);

      // Update shopping brief
      const briefParts: string[] = [];
      if (newConstraints.budgetMax) briefParts.push(`Budget: ₹${newConstraints.budgetMax}`);
      if (newConstraints.category) briefParts.push(newConstraints.category);
      if (newConstraints.color) briefParts.push(newConstraints.color);
      if (newConstraints.colorExclude) briefParts.push(`Exclude ${newConstraints.colorExclude}`);
      if (newConstraints.occasion) briefParts.push(newConstraints.occasion);
      if (newConstraints.style) briefParts.push(newConstraints.style);
      setShoppingBrief(briefParts.length > 0 ? briefParts.join(" • ") : null);

      // Clear reply text
      setReplyText("");
    } catch (error) {
      console.error("Follow-up error:", error);
      toast.error("Failed to refine search. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Search using API
  const handleSearch = async (userAnswer?: string | null, updatedConstraints?: Record<string, string | number | null>) => {
    const searchQuery = session?.originalQuery || query;
    if (!searchQuery.trim() && !session) return;

    setIsLoading(true);
    setResults([]);
    if (!userAnswer && !updatedConstraints) {
      setConstraints({});
    }
    if (!userAnswer && !updatedConstraints) {
      setAssistantMessages([]);
    }
    setIsAssistantTyping(false);

    try {
      // Merge constraints if provided
      const finalConstraints = updatedConstraints || constraints;
      
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          provider: provider === "openai" ? "openai" : "anthropic",
          userAnswer: userAnswer || null,
          session: session || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
      setConstraints(data.constraints || {});
      setAssistantQuestion(data.assistantQuestion || null);
      setSession(data.session || null);
      
      // Debug: Log when question is set
      if (data.assistantQuestion) {
        console.log("Assistant question set:", data.assistantQuestion);
        console.log("Session:", data.session);
      }
      
      // Store original query when starting a new search
      if (!userAnswer && !session) {
        setOriginalQuery(query);
      }
      
      // Clear reply text after sending answer
      if (userAnswer) {
        setReplyText("");
      }

      // Extract shopping brief from constraints
      const briefParts: string[] = [];
      if (data.constraints.budgetMax) briefParts.push(`Budget: ₹${data.constraints.budgetMax}`);
      if (data.constraints.category) briefParts.push(data.constraints.category);
      if (data.constraints.color) briefParts.push(data.constraints.color);
      if (data.constraints.occasion) briefParts.push(data.constraints.occasion);
      if (data.constraints.style) briefParts.push(data.constraints.style);
      setShoppingBrief(briefParts.length > 0 ? briefParts.join(" • ") : null);

      // Add assistant question to messages if present
      if (data.assistantQuestion && !userAnswer) {
        setIsAssistantTyping(true);
        setTimeout(() => {
          const assistantMessage: AssistantMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: data.assistantQuestion,
            timestamp: new Date(),
          };
          setAssistantMessages([assistantMessage]);
          setIsAssistantTyping(false);
        }, 800);
      } else if (data.results?.length > 0) {
        // Show results message
        setIsAssistantTyping(true);
        setTimeout(() => {
          const assistantMessage: AssistantMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: `Found ${data.results.length} results`,
            timestamp: new Date(),
          };
          setAssistantMessages((prev) => [...prev, assistantMessage]);
          setIsAssistantTyping(false);
        }, 500);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Please try again.");
      setResults([]);
      // Keep reply text on error
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sending reply
  const handleSendReply = async () => {
    if (!replyText.trim() || isLoading) return;

    const text = replyText.trim();

    // If there's an active question, treat as answer
    if (assistantQuestion && !session?.asked) {
      const userMessage: AssistantMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setAssistantMessages((prev) => [...prev, userMessage]);
      setIsAssistantTyping(true);

      // Search with answer
      await handleSearch(text);
    } else if (session && results.length > 0) {
      // Otherwise, treat as follow-up refinement
      const userMessage: AssistantMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setAssistantMessages((prev) => [...prev, userMessage]);
      await handleFollowUp(text);
    }
  };

  // Clear session when query changes (new search)
  useEffect(() => {
    if (query !== originalQuery && originalQuery) {
      setSession(null);
      setAssistantQuestion(null);
      setReplyText("");
      setShoppingBrief(null);
      setOriginalQuery("");
    }
  }, [query, originalQuery]);

  // Handle constraint removal
  const handleRemoveConstraint = useCallback((key: string) => {
    const newConstraints = { ...constraints, [key]: null };
    setConstraints(newConstraints);
    
    // Clear session and trigger new search to refresh results
    const searchQuery = session?.originalQuery || query;
    if (searchQuery) {
      setSession(null);
      setQuery(searchQuery);
      setTimeout(() => {
        handleSearch();
      }, 100);
    }
  }, [constraints, session, query]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cartsDialogOpen) {
          setCartsDialogOpen(false);
        }
        if (compareOpen) {
          setCompareOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartsDialogOpen, compareOpen]);

  // Pin product for comparison
  const handlePinProduct = (product: Product) => {
    if (compareProducts.find((p) => p.id === product.id)) {
      setCompareProducts(compareProducts.filter((p) => p.id !== product.id));
      if (compareProducts.length === 2 && compareProducts[0].id === product.id) {
        setCompareVerdict(null);
      }
    } else if (compareProducts.length < 2) {
      const newProducts = [...compareProducts, product];
      setCompareProducts(newProducts);
      if (newProducts.length === 2) {
        setCompareOpen(true);
        handleLoadCompareVerdict(newProducts[0], newProducts[1]);
      }
    } else {
      toast.info("Maximum 2 products can be compared");
    }
  };

  // Load product insight
  const handleLoadProductInsight = async (product: Product) => {
    setIsLoadingInsight(true);
    setProductInsight(null);

    try {
      const candidateIds = results.slice(0, 10).map((r) => r.id);
      
      const response = await fetch("/api/product/insight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          provider: provider === "openai" ? "openai" : "anthropic",
          brief: constraints,
          candidateIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load insight");
      }

      const data = await response.json();
      setProductInsight(data);
    } catch (error) {
      console.error("Product insight error:", error);
      toast.error("Failed to load product insights");
    } finally {
      setIsLoadingInsight(false);
    }
  };

  // Load compare verdict
  const handleLoadCompareVerdict = async (productA: Product, productB: Product) => {
    setIsLoadingVerdict(true);
    setCompareVerdict(null);

    try {
      const response = await fetch("/api/compare/verdict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: provider === "openai" ? "openai" : "anthropic",
          brief: constraints,
          a: productA,
          b: productB,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load verdict");
      }

      const data = await response.json();
      setCompareVerdict(data);
    } catch (error) {
      console.error("Compare verdict error:", error);
      toast.error("Failed to load comparison");
    } finally {
      setIsLoadingVerdict(false);
    }
  };

  // Swap product in detail drawer with alternative
  const handleSwapAlternative = async (alternativeId: string) => {
    const alternative = results.find((r) => r.id === alternativeId);
    if (alternative && selectedProduct) {
      setSelectedProduct(alternative);
      await handleLoadProductInsight(alternative);
      toast.success("Swapped to alternative");
    }
  };

  // Legacy function - now using handleSendReply, but keeping for quick buttons
  const handleApplyAnswer = (answer: string) => {
    if (!assistantQuestion || session?.asked) {
      return;
    }
    setReplyText(answer);
    setTimeout(() => handleSendReply(), 100);
  };

  const handleBuildCarts = async () => {
    if (!query.trim() && !session?.originalQuery) {
      toast.error("Please search first");
      return;
    }

    setIsBuildingCarts(true);
    setCartsDialogOpen(true);

    try {
      const response = await fetch("/api/cart/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: session?.originalQuery || query,
          provider: provider === "openai" ? "openai" : "anthropic",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to build carts");
      }

      const data = await response.json();
      setCarts(data.carts || []);
      toast.success("Carts built successfully!");
    } catch (error) {
      console.error("Cart build error:", error);
      toast.error("Failed to build carts. Please try again.");
    } finally {
      setIsBuildingCarts(false);
    }
  };

  const handleCopySummary = (cart: Cart) => {
    const summary = `${cart.name} Cart (₹${cart.items.reduce((sum, item) => sum + item.price, 0).toLocaleString()})\n\n${cart.items.map((item, idx) => `${idx + 1}. ${item.title} - ₹${item.price}\n   ${item.why}`).join("\n\n")}\n\n${cart.notes.join("\n")}`;
    navigator.clipboard.writeText(summary);
    toast.success("Summary copied to clipboard!");
  };

  const insertDemoQuery = (demoQuery: string) => {
    setQuery(demoQuery);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Premium Search</h1>
            </div>
            <Tabs value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <TabsList>
                <TabsTrigger value="openai">OpenAI</TabsTrigger>
                <TabsTrigger value="anthropic">Claude</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Sticky Search Bar */}
      <div className="sticky top-[57px] z-40 bg-white/80 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex gap-3 items-center max-w-4xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="pl-12 h-12 text-base shadow-sm border-2 focus:border-primary/50"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 px-4">
                  Examples
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {demoQueries.map((demoQuery, idx) => (
                  <DropdownMenuItem
                    key={idx}
                    onClick={() => insertDemoQuery(demoQuery)}
                    className="cursor-pointer"
                  >
                    {demoQuery}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="h-12 px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {/* Constraint Chips */}
          <AnimatePresence>
            {Object.entries(constraints).some(([_, v]) => v !== null) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 mt-3 justify-center flex-wrap"
              >
                {Object.entries(constraints).map(([key, value], idx) => {
                  if (value === null) return null;
                  const label = key === "budgetMax" ? `Under ₹${value}` : String(value);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge
                        variant="secondary"
                        className="px-3 py-1 text-sm font-medium cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        {label}
                        <button
                          onClick={() => handleRemoveConstraint(key)}
                          className="ml-2 hover:bg-muted rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">

        {/* Results and Assistant Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Results Grid */}
          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="overflow-hidden border">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-3 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
              >
                {results.map((result, idx) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 h-full border hover:border-primary/20 group cursor-pointer"
                      onClick={() => {
                        setSelectedProduct(result);
                        setProductDetailOpen(true);
                        handleLoadProductInsight(result);
                      }}
                    >
                      <div className="relative h-48 bg-muted overflow-hidden">
                        <img
                          src={result.imageUrl}
                          alt={result.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${result.id}/600/800`;
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinProduct(result);
                          }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm z-10"
                          title={compareProducts.find((p) => p.id === result.id) ? "Remove from compare" : "Add to compare"}
                        >
                          {compareProducts.find((p) => p.id === result.id) ? (
                            <Pin className="h-4 w-4 text-primary fill-primary" />
                          ) : (
                            <PinOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
                          {result.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">
                          {result.brand}
                        </p>
                        <p className="text-lg font-bold text-primary mb-3">
                          ₹{result.price.toLocaleString()}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <Badge variant="secondary" className="text-xs">
                            {result.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {result.color}
                          </Badge>
                        </div>
                        {result.reasons && result.reasons.length > 0 && (
                          <div className="pt-3 border-t">
                            <p className="text-xs font-medium mb-1.5 text-muted-foreground">Why:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {result.reasons.slice(0, 2).map((reason, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span className="leading-relaxed">{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12"
              >
                <div className="text-center max-w-md mx-auto">
                  <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-40" />
                  <h3 className="text-xl font-semibold mb-2">Start your search</h3>
                  <p className="text-muted-foreground mb-6">Try one of these examples:</p>
                  <div className="space-y-2">
                    {demoQueries.slice(0, 3).map((demoQuery, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setQuery(demoQuery);
                            setTimeout(() => handleSearch(), 100);
                          }}
                        >
                          <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="flex-1">{demoQuery}</span>
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Assistant Panel */}
          <div className="lg:sticky lg:top-[145px] lg:h-[calc(100vh-145px)] order-first lg:order-last">
            <Card className="h-full flex flex-col shadow-lg border">
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-base">Assistant</h2>
                  {session?.asked && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Asked
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {assistantMessages.length === 0 && !isAssistantTyping && !shoppingBrief && (
                  <div className="text-center text-muted-foreground py-8">
                    <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Start searching</p>
                  </div>
                )}

                {/* Shopping Brief Card */}
                {shoppingBrief && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted/50 rounded-lg p-3 border"
                  >
                    <p className="text-xs font-medium mb-1.5 text-muted-foreground">Understood</p>
                    <p className="text-sm leading-relaxed">{shoppingBrief}</p>
                  </motion.div>
                )}

                {/* Status Line */}
                {results.length > 0 && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-muted-foreground pb-2 border-b"
                  >
                    Showing {results.length} results
                  </motion.div>
                )}

                {/* Question (only when needed) */}
                {assistantQuestion && !session?.asked && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted rounded-lg p-3"
                  >
                    <p className="text-sm mb-3">{assistantQuestion}</p>
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8"
                        onClick={() => handleApplyAnswer("More relaxed")}
                      >
                        More relaxed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-8"
                        onClick={() => handleApplyAnswer("More formal")}
                      >
                        More formal
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Or type your answer below
                    </p>
                  </motion.div>
                )}

                {/* Messages */}
                <AnimatePresence>
                  {assistantMessages
                    .filter((msg) => msg.role === "user" || (!assistantQuestion || session?.asked))
                    .map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {message.content}
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>

                {isAssistantTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex gap-1">
                        <motion.div
                          className="h-1.5 w-1.5 bg-muted-foreground rounded-full"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="h-1.5 w-1.5 bg-muted-foreground rounded-full"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="h-1.5 w-1.5 bg-muted-foreground rounded-full"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Quick Refinement Chips - Show after results */}
              {results.length > 0 && session && !assistantQuestion && (
                <div className="px-4 pt-3 pb-2 border-t">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "More formal",
                      "More relaxed",
                      "Under 3000",
                      "Under 6000",
                      "Exclude black",
                      "Show shirts",
                      "Show sneakers",
                    ].map((chip) => (
                      <Button
                        key={chip}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setReplyText(chip);
                          setTimeout(() => handleFollowUp(chip), 100);
                        }}
                        disabled={isLoading}
                      >
                        {chip}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reply Input - Always show after first search */}
              {(assistantQuestion && !session?.asked) || (results.length > 0 && session) ? (
                <div className="p-4 border-t bg-background">
                  {assistantQuestion && !session?.asked && (
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Reply to assistant:
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={
                        assistantQuestion && !session?.asked
                          ? "Answer the question"
                          : "Refine results, e.g. exclude black, under 4000"
                      }
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      disabled={isLoading}
                      className="flex-1"
                      autoFocus={!!(assistantQuestion && !session?.asked)}
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={isLoading || !replyText.trim()}
                      size="default"
                      className="shrink-0"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}

              {results.length > 0 && !assistantQuestion && (
                <div className="p-4 border-t">
                  <Button
                    onClick={handleBuildCarts}
                    className="w-full"
                    variant="default"
                    disabled={isBuildingCarts}
                    size="sm"
                  >
                    {isBuildingCarts ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Building...
                      </>
                    ) : (
                      "Build 3 Carts"
                    )}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Cart Building Dialog */}
      <Dialog open={cartsDialogOpen} onOpenChange={setCartsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Your Shopping Carts</DialogTitle>
          </DialogHeader>

          {carts.length > 0 ? (
            <Tabs defaultValue="Budget" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                {carts.map((cart) => (
                  <TabsTrigger key={cart.name} value={cart.name}>
                    {cart.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {carts.map((cart) => (
                <TabsContent key={cart.name} value={cart.name} className="mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{cart.name} Cart</h3>
                        <p className="text-sm text-muted-foreground">
                          Total: ₹{cart.items.reduce((sum, item) => sum + item.price, 0).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopySummary(cart)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy summary
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {cart.items.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                          <Card className="overflow-hidden h-full">
                            <div className="relative h-48 bg-muted overflow-hidden">
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/600/800`;
                                }}
                              />
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                                {item.title}
                              </h4>
                              <p className="text-xs text-muted-foreground mb-2">
                                {item.brand}
                              </p>
                              <p className="text-lg font-bold text-primary mb-3">
                                ₹{item.price.toLocaleString()}
                              </p>
                              <div className="pt-3 border-t">
                                <p className="text-xs font-medium mb-1 text-muted-foreground">
                                  Why this fits:
                                </p>
                                <p className="text-xs leading-relaxed">{item.why}</p>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>

                    <Card className="p-4 bg-muted/50">
                      <h4 className="font-semibold text-sm mb-2">Cart Notes</h4>
                      <ul className="space-y-1">
                        {cart.notes.map((note, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Building your carts...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Detail Drawer */}
      <Sheet open={productDetailOpen} onOpenChange={setProductDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedProduct ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedProduct.title}</SheetTitle>
                <SheetDescription>{selectedProduct.brand}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Large Image */}
                <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${selectedProduct.id}/600/800`;
                    }}
                  />
                </div>

                {/* Price */}
                <div>
                  <p className="text-3xl font-bold text-primary">
                    ₹{selectedProduct.price.toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary">{selectedProduct.category}</Badge>
                    <Badge variant="outline">{selectedProduct.color}</Badge>
                  </div>
                </div>

                {/* Fit for your brief */}
                {isLoadingInsight ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : productInsight?.fitSummary ? (
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-2">Fit for your brief</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {productInsight.fitSummary}
                    </p>
                  </Card>
                ) : null}

                {/* Tradeoffs */}
                {isLoadingInsight ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : productInsight?.tradeoffs && productInsight.tradeoffs.length > 0 ? (
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">Tradeoffs</h4>
                    <ul className="space-y-2">
                      {productInsight.tradeoffs.map((tradeoff: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{tradeoff}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                {/* How to style it */}
                {isLoadingInsight ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : productInsight?.styling && productInsight.styling.length > 0 ? (
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">How to style it</h4>
                    <ul className="space-y-2">
                      {productInsight.styling.map((tip: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                {/* 2 Alternatives */}
                {isLoadingInsight ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  </div>
                ) : productInsight?.alternatives && productInsight.alternatives.length > 0 ? (
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-3">2 Alternatives</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {productInsight.alternatives.map((alt: { id: string; reason: string }) => {
                        const altProduct = results.find((r) => r.id === alt.id);
                        if (!altProduct) return null;
                        return (
                          <Card key={alt.id} className="overflow-hidden border">
                            <div className="relative h-32 bg-muted overflow-hidden">
                              <img
                                src={altProduct.imageUrl}
                                alt={altProduct.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${altProduct.id}/600/800`;
                                }}
                              />
                            </div>
                            <CardContent className="p-3">
                              <h5 className="font-semibold text-xs mb-1 line-clamp-1">
                                {altProduct.title}
                              </h5>
                              <p className="text-xs font-bold text-primary mb-2">
                                ₹{altProduct.price.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {alt.reason}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-7"
                                onClick={() => handleSwapAlternative(alt.id)}
                              >
                                Swap
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </Card>
                ) : null}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handlePinProduct(selectedProduct);
                      if (compareProducts.length === 1) {
                        setProductDetailOpen(false);
                      }
                    }}
                  >
                    {compareProducts.find((p) => p.id === selectedProduct.id) ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        Remove from compare
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        Add to compare
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Compare Drawer */}
      <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Compare Products</SheetTitle>
            <SheetDescription>
              {compareProducts.length === 0
                ? "Pin products to compare"
                : compareProducts.length === 2
                ? "Comparing 2 products"
                : `${compareProducts.length} of 2 products selected`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {compareProducts.length === 0 ? (
              <div className="text-center py-12">
                <PinOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">
                  Pin up to 2 products from search results to compare
                </p>
              </div>
            ) : compareProducts.length === 2 ? (
              <>
                {/* Assistant Verdict */}
                {isLoadingVerdict ? (
                  <Card className="p-4">
                    <Skeleton className="h-4 w-32 mb-3" />
                    <Skeleton className="h-16 w-full" />
                  </Card>
                ) : compareVerdict ? (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-sm">Assistant Verdict</h4>
                      {compareVerdict.tags && compareVerdict.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {compareVerdict.tags.map((tag: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed mb-4">{compareVerdict.verdict}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-medium mb-1.5">Product A:</p>
                        <ul className="space-y-1">
                          {compareVerdict.bulletsA?.map((bullet: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium mb-1.5">Product B:</p>
                        <ul className="space-y-1">
                          {compareVerdict.bulletsB?.map((bullet: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                ) : null}

                {/* Comparison Table */}
                <div className="grid grid-cols-2 gap-6">
                  {compareProducts.map((product, idx) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="relative">
                        <button
                          onClick={() => handlePinProduct(product)}
                          className="absolute top-2 right-2 p-2 rounded-full bg-white shadow-sm hover:bg-muted transition-colors z-10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="relative h-64 bg-muted rounded-lg overflow-hidden">
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${product.id}/600/800`;
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{product.title}</h3>
                          <p className="text-sm text-muted-foreground">{product.brand}</p>
                        </div>

                        {/* Attribute Rows */}
                        <div className="space-y-2 pt-3 border-t">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="font-medium">{product.category}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Color:</span>
                            <Badge variant="outline" className="text-xs">{product.color}</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-bold text-primary">₹{product.price.toLocaleString()}</span>
                          </div>
                          {product.reasons && product.reasons.length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-xs font-medium mb-1.5 text-muted-foreground">Why this matches:</p>
                              <ul className="space-y-1">
                                {product.reasons.slice(0, 2).map((reason, rIdx) => (
                                  <li key={rIdx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">•</span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <Pin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">Pin another product to compare</p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

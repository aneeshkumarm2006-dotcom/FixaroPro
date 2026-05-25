"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  History,
  MapPin,
  Package,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { getLocationProducts } from "../../actions/getLocationProducts";
import type { LocationProductEntry } from "../../actions/getLocationProducts.types";
import { checkoutInventory } from "../../actions/checkoutInventory";
import CartItem from "./CartItem";
import CheckoutSummary from "./CheckoutSummary";

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface CheckoutClientProps {
  locations: Location[];
}

type Step = 1 | 2 | 3;

export default function CheckoutClient({ locations }: CheckoutClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [products, setProducts] = useState<LocationProductEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedLocation = locations.find((l) => l.id === locationId) || null;

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setLoading(true);
    getLocationProducts(locationId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success) {
        setProducts(res.products);
      } else {
        setFeedback({ type: "error", text: res.error });
        setProducts([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        (p.productDescription || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.productId === productId);
        if (!product) return null;
        return {
          productId,
          productName: product.productName,
          unit: product.unit,
          available: product.available,
          quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, products]);

  const cartCount = cartItems.length;
  const hasOverLimit = cartItems.some((i) => i.quantity > i.available);

  function selectLocation(id: string) {
    if (id !== locationId) {
      setCart({});
    }
    setLocationId(id);
    setFeedback(null);
    setStep(2);
  }

  function addToCart(product: LocationProductEntry) {
    setCart((prev) => {
      const existing = prev[product.productId] || 0;
      const next = Math.min(existing + 1, product.available);
      return { ...prev, [product.productId]: next };
    });
  }

  function updateCart(productId: string, quantity: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = quantity;
      }
      return next;
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  async function confirmCheckout() {
    if (!locationId || cartItems.length === 0) return;
    if (hasOverLimit) {
      setFeedback({
        type: "error",
        text: "Some items exceed available stock. Adjust quantities to continue.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const res = await checkoutInventory({
      locationId,
      notes: notes.trim() || undefined,
      items: cartItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    });

    setSubmitting(false);

    if (res.success) {
      setFeedback({
        type: "success",
        text: `Pickup confirmed. ${cartItems.length} item(s) added to your inventory.`,
      });
      setCart({});
      setNotes("");
      setTimeout(() => {
        router.push("/my-inventory");
        router.refresh();
      }, 900);
    } else {
      setFeedback({ type: "error", text: res.error || "Checkout failed." });
    }
  }

  return (
    <div className="space-y-6">
      <Card variant="ghost">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Button
              variant="ghost"
              size="sm"
              submit={false}
              href="/my-inventory"
              className="!px-2 mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="text-3xl font-[400] text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-[#005F6A]" />
              Inventory Pickup
            </h1>
            <p className="text-sm text-[#005F6A]/70 mt-1">
              Pick up equipment and supplies from a storage location
            </p>
          </div>
          <Button
            variant="ghost"
            size="md"
            submit={false}
            href="/my-inventory/history">
            <History className="w-4 h-4 mr-1.5" />
            View History
          </Button>
        </div>
      </Card>

      <Stepper step={step} />

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            feedback.type === "success"
              ? "bg-[#005F6A]/10 text-[#005F6A] border border-[#005F6A]/15"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
          {feedback.text}
        </div>
      )}

      {step === 1 && (
        <Card variant="default" className="p-6 space-y-4">
          <h2 className="text-xl font-[400] text-gray-900">
            Select a Storage Location
          </h2>
          {locations.length === 0 ? (
            <p className="text-sm text-gray-500">
              No storage locations available. Ask an admin to set one up.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {locations.map((l) => (
                <button
                  key={l.id}
                  onClick={() => selectLocation(l.id)}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    locationId === l.id
                      ? "border-[#005F6A] bg-[#005F6A]/5"
                      : "border-gray-200 hover:border-[#005F6A]/40 hover:bg-gray-50"
                  }`}>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#005F6A] mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-[400] text-gray-900">{l.name}</div>
                      {l.address && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {l.address}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === 2 && selectedLocation && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card variant="default" className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-[#005F6A]">
                <MapPin className="w-4 h-4" />
                <span className="font-[400]">{selectedLocation.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  submit={false}
                  onClick={() => setStep(1)}
                  className="!px-2">
                  Change
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                variant="form"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>

            {loading ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                Loading products...
              </p>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                {products.length === 0 ? (
                  <>
                    <p className="font-[400] text-gray-900 mb-1">No items in stock at this location</p>
                    <p>Try selecting a different location, or contact your manager to restock.</p>
                  </>
                ) : (
                  "No products match your search."
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const inCart = cart[p.productId] || 0;
                  return (
                    <div
                      key={p.productId}
                      className="flex items-center justify-between gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-[400] text-gray-900">
                          {p.productName}
                        </div>
                        {p.productDescription && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {p.productDescription}
                          </div>
                        )}
                        <div className="mt-1">
                          <Badge variant="cleano" size="xs" className="!w-fit">
                            {p.available} {p.unit} available
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {inCart > 0 ? (
                          <Badge variant="cleano" size="sm" className="!w-fit">
                            {inCart} in cart
                          </Badge>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            submit={false}
                            onClick={() => addToCart(p)}>
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card variant="default" className="p-5 h-fit lg:sticky lg:top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-[400] text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Cart
              </h3>
              <span className="text-xs text-gray-500">
                {cartCount} item{cartCount === 1 ? "" : "s"}
              </span>
            </div>
            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                Your cart is empty
              </p>
            ) : (
              <div>
                {cartItems.map((i) => {
                  const product = products.find(
                    (p) => p.productId === i.productId
                  );
                  if (!product) return null;
                  return (
                    <CartItem
                      key={i.productId}
                      product={product}
                      quantity={i.quantity}
                      onChange={updateCart}
                      onRemove={removeFromCart}
                    />
                  );
                })}
              </div>
            )}
            {hasOverLimit && (
              <p className="text-xs text-red-600 mt-2">
                Some items exceed available stock.
              </p>
            )}
            <Button
              variant="primary"
              size="md"
              submit={false}
              onClick={() => setStep(3)}
              disabled={cartItems.length === 0 || hasOverLimit}
              className="w-full mt-4">
              Review Pickup
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Card>
        </div>
      )}

      {step === 3 && selectedLocation && (
        <CheckoutSummary
          locationName={selectedLocation.name}
          locationAddress={selectedLocation.address}
          items={cartItems.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            unit: i.unit,
            quantity: i.quantity,
          }))}
          notes={notes}
          onNotesChange={setNotes}
          onConfirm={confirmCheckout}
          onBack={() => setStep(2)}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Select Location" },
    { n: 2, label: "Choose Items" },
    { n: 3, label: "Confirm" },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-[400] transition-colors ${
                active
                  ? "bg-[#005F6A] text-white"
                  : done
                  ? "bg-[#005F6A]/15 text-[#005F6A]"
                  : "bg-gray-100 text-gray-500"
              }`}>
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  {s.n}
                </span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className="w-4 sm:w-6 h-px bg-gray-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}

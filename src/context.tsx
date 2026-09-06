import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createBooking as createBookingRpc,
  cancelBooking as cancelBookingRpc,
  getCustomerBookings,
  type CreateBookingInput,
} from "./lib/bookings";
import type { BookingRow } from "./types";
import { useAuth } from "./auth";

/* ----------------------------- Toast ----------------------------- */

type ToastValue = { toast: string; showToast: (message: string) => void };
const ToastContext = createContext<ToastValue>({ toast: "", showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");
  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);
  const value = useMemo(() => ({ toast, showToast }), [toast, showToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastValue {
  return useContext(ToastContext);
}

export function ToastViewport() {
  const { toast } = useToast();
  return toast ? <div className="toast">{toast}</div> : null;
}

/* ---------------------------- Bookings --------------------------- */
/* Supabase is the single source of truth. Legacy local demo bookings are
   cleared once on mount so they never resurface as fake data. */

type BookingsValue = {
  bookings: BookingRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createBooking: (input: CreateBookingInput) => Promise<BookingRow>;
  cancelBooking: (id: string) => Promise<void>;
};

const BookingsContext = createContext<BookingsValue>({
  bookings: [],
  loading: false,
  error: null,
  refresh: async () => {},
  createBooking: async () => {
    throw new Error("غير متاح");
  },
  cancelBooking: async () => {},
});

const LEGACY_KEY = "maak-bookings";

export function BookingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bookings are always scoped to the signed-in user by RLS. Without a session
  // there is nothing to load, so we skip the request and expose an empty list.
  const refresh = useCallback(async () => {
    if (!userId) {
      setBookings([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBookings(await getCustomerBookings());
    } catch {
      setError("bookings.loadError");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Re-load whenever the authenticated user changes (sign-in, sign-out,
  // account switch) so the list never shows another session's data.
  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const createBooking = useCallback(async (input: CreateBookingInput) => {
    const row = await createBookingRpc(input);
    setBookings((current) => [row, ...current]);
    return row;
  }, []);

  const cancelBooking = useCallback(async (id: string) => {
    const row = await cancelBookingRpc(id);
    setBookings((current) =>
      current.map((booking) => (booking.id === id ? row : booking)),
    );
  }, []);

  const value = useMemo(
    () => ({ bookings, loading, error, refresh, createBooking, cancelBooking }),
    [bookings, loading, error, refresh, createBooking, cancelBooking],
  );
  return (
    <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>
  );
}

export function useBookings(): BookingsValue {
  return useContext(BookingsContext);
}

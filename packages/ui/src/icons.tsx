// Ikoner: Lucide. Ett namn per begrepp så att manifest och guider kan peka på ikoner med text.
import {
  Receipt, Users, Wallet, ShieldCheck, Paintbrush, CalendarDays, Upload, Eye, Check, Send, Bell, Car, FileText, RefreshCw,
  AlertTriangle, Truck, Inbox, Link2, Sparkles, Landmark, Home, Layers, Plus, Settings, BookOpen, HelpCircle, Search, ChevronDown,
  ChevronRight, ChevronLeft, ArrowRight, Download, Lock, X, Menu, LogOut, Pencil, Building2, Smartphone, LayoutGrid, Mail, Clock,
  CircleHelp, Package, CreditCard, LifeBuoy, Phone, Info, Trash2, ExternalLink, Filter, MoreHorizontal, CheckCircle2, Circle, Undo2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  receipt: Receipt, users: Users, wallet: Wallet, shield: ShieldCheck, brush: Paintbrush, calendar: CalendarDays, upload: Upload, eye: Eye,
  check: Check, send: Send, bell: Bell, car: Car, file: FileText, refresh: RefreshCw, alert: AlertTriangle, truck: Truck, inbox: Inbox,
  link: Link2, sparkles: Sparkles, bank: Landmark, home: Home, layers: Layers, plus: Plus, settings: Settings, book: BookOpen, help: HelpCircle,
  search: Search, down: ChevronDown, right: ChevronRight, left: ChevronLeft, arrow: ArrowRight, download: Download, lock: Lock, x: X, menu: Menu,
  logout: LogOut, pencil: Pencil, building: Building2, phone: Smartphone, grid: LayoutGrid, mail: Mail, clock: Clock, question: CircleHelp,
  package: Package, card: CreditCard, support: LifeBuoy, tel: Phone, info: Info, trash: Trash2, external: ExternalLink, filter: Filter,
  more: MoreHorizontal, ok: CheckCircle2, circle: Circle, undo: Undo2
};

export function Icon({ name, size = 16, strokeWidth = 1.9, ...rest }: { name: string; size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }) {
  const C = ICONS[name] || Circle;
  return <C size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}

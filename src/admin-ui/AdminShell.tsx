"use client";

import type { PointerEvent, ReactNode, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TabId = "dashboard" | "funnel" | "users" | "creators" | "stores" | "content" | "settings";
type SubTabId =
  | "funnel_overview"
  | "ad_tests"
  | "share_links"
  | "user_list"
  | "waitlist"
  | "waitlist_survey"
  | "saved_places"
  | "created_routes"
  | "activity_logs"
  | "creator_list"
  | "creator_photos"
  | "creator_contacts"
  | "store_list"
  | "store_contacts"
  | "partnership_status"
  | "content_dashboard"
  | "photo_management"
  | "scrap_management"
  | "tag_management"
  | "photo_review";

type NavItem = {
  description: string;
  icon: ReactNode;
  id: TabId;
  label: string;
  subTabs?: Array<{ id: SubTabId; label: string }>;
};

type PhotoSourceType = "team" | "owner" | "creator" | "licensed" | "naver";

type PlaceRow = {
  address?: string;
  best_for?: string[];
  category_id?: string;
  cover_photo_id?: string | null;
  cover_image_url?: string;
  editorial_note?: string;
  hours_text?: string;
  instagram_url?: string;
  id: string;
  image_credit?: "team" | "owner" | "creator" | "licensed" | "unsplash" | "naver";
  image_urls?: string[];
  last_checked_at?: string | null;
  lat?: number;
  lng?: number;
  mood_tags?: string[];
  name?: string;
  naver_place_url?: string;
  nearest_station?: string;
  neighborhood_id?: string;
  photo_qa_status?: "pending" | "approved" | "rejected";
  place_photos?: PlacePhotoRow[];
  phone_text?: string;
  price_hint?: string;
  qa_status?: "draft" | "ready" | "needs_fix";
  representative_menu_name?: string;
  representative_menu_price?: string;
  route_role?: "start" | "middle" | "finish" | "pause";
  short_copy?: string;
  status?: "draft" | "ready" | "inactive";
  stay_time_minutes?: number;
  sub_area?: string;
  time_tags?: string[];
};

type PlacePhotoRow = {
  bucket_id?: string;
  credit_text?: string;
  crop_x?: number | null;
  crop_y?: number | null;
  crop_zoom?: number | null;
  display_order?: number;
  id?: string;
  permission_status?: "pending" | "approved" | "rejected";
  photo_type?: "cover" | "gallery" | "original" | "rights";
  public_url?: string;
  rights_holder_name?: string;
  source_type?: PhotoSourceType;
  storage_path?: string;
  usage_scope?: string;
};

type PhotoCrop = {
  x: number;
  y: number;
  zoom: number;
};

type CreatorSubmission = {
  created_at?: string;
  creator_profiles?: {
    display_name?: string;
    email?: string;
    id?: string;
    instagram_url?: string;
  };
  creator_submission_photos?: Array<{
    created_at?: string;
    id?: string;
    review_status?: string;
    selected_for_card?: boolean;
    signed_url?: string;
  }>;
  id: string;
  place_category?: string;
  place_name?: string;
  place_road_address?: string;
  status?: string;
};

type ContentTagKind = "mood" | "situation" | "time";

type ContentTag = {
  display_order?: number;
  id: string;
  kind: ContentTagKind;
  name: string;
  status?: "active" | "inactive";
};

type OpsData = {
  categories: Array<{ id: string; name: string }>;
  contentTags: ContentTag[];
  neighborhoods: Array<{ id: string; name: string }>;
  places: PlaceRow[];
  submissions: CreatorSubmission[];
};

type OpsDataUpdater = (updater: (current: OpsData) => OpsData) => void;

type DialogState = {
  body: ReactNode;
  confirmLabel?: string;
  description?: string;
  hideActions?: boolean;
  title: string;
};

type OpenDialog = (dialog: DialogState) => void;

type CampaignDrafts = Record<string, { label?: string; link?: string; views?: string }>;
type HiddenCampaigns = string[];

type CreatorPhotoProvider = {
  handle: string;
  key: string;
  name: string;
  photoCount: number;
  placeCount: number;
  placeGroups?: CreatorPlacePhotoGroup[];
  providerType: "Doripe" | "Naver" | "가게" | "큐레이터";
  submissions: CreatorSubmission[];
};

type PhotoProviderOption = {
  key: string;
  label: string;
  meta: string;
  sourceType: PhotoSourceType;
};

type KakaoPostcodeData = {
  address?: string;
  apartment?: "Y" | "N";
  bname?: string;
  buildingName?: string;
  jibunAddress?: string;
  roadAddress?: string;
  userSelectedType?: "R" | "J";
  zonecode?: string;
};

type KakaoPostcodeConstructor = new (options: {
  height?: string;
  maxSuggestItems?: number;
  oncomplete: (data: KakaoPostcodeData) => void;
  onresize?: (size: { height: number }) => void;
  theme?: Record<string, string>;
  width?: string;
}) => {
  embed: (element: HTMLElement, options?: { q?: string }) => void;
  open: (options?: { popupKey?: string; popupTitle?: string; q?: string }) => void;
};

declare global {
  interface Window {
    kakao?: {
      Postcode?: KakaoPostcodeConstructor;
    };
  }
}

type LibraryPhoto = {
  created_at?: string;
  id?: string;
  review_status?: string;
  selected_for_card?: boolean;
  signed_url?: string;
};

type CreatorPlacePhotoGroup = {
  category: string;
  latestAt: string;
  name: string;
  photos: LibraryPhoto[];
  status: string;
  submissionIds: string[];
};

const emptyOpsData: OpsData = {
  categories: [],
  contentTags: [],
  neighborhoods: [],
  places: [],
  submissions: [],
};

const contactStatuses = ["연락 전", "연락 중", "답변 중", "승인", "거절"];

type DistributionDatum = {
  label: string;
  value: number;
};

type AdminSignup = {
  age: string;
  betaCommitment: string;
  betaResult: string;
  campaignCode: string;
  date: string;
  desiredFeatures: string[];
  email: string;
  gender: string;
  id: number;
  opinion: string;
  painPoint: string;
  phone: string;
  recentSearchMethods: string[];
  region: string;
  saveLocations: string[];
};

type AdminStats = {
  campaigns: Array<{
    adViews: number;
    code: string;
    label: string;
    link: string;
    notifyArrivals: number;
    signups: number;
    step1: number;
    step2: number;
    step3: number;
    step7: number;
    views: number;
  }>;
  error?: string | null;
  funnel: Array<{ label: string; value: number }>;
  insights: {
    age: DistributionDatum[];
    betaCommitments: DistributionDatum[];
    betaResults: DistributionDatum[];
    features: DistributionDatum[];
    gender: DistributionDatum[];
    opinions: DistributionDatum[];
    painPoints: DistributionDatum[];
    recentSearchMethods: DistributionDatum[];
    region: DistributionDatum[];
    saveLocations: DistributionDatum[];
  };
  kpi: {
    arrivals: number;
    conversionRate: number;
    pageViews: number;
    signups: number;
    todayArrivals: number;
    todayPageViews: number;
    todaySignups: number;
  };
  recentSignups: AdminSignup[];
  timeline: Array<{ bucket: string; notifyArrivals: number; pageViews: number; signups: number }>;
  version: "v2";
};

type FunnelChartPeriod = "day" | "week" | "month";

type FunnelChartRow = AdminStats["timeline"][number] & {
  label: string;
  tooltipLabel: string;
};

const emptyStats: AdminStats = {
  campaigns: [],
  error: null,
  funnel: [],
  insights: {
    age: [],
    betaCommitments: [],
    betaResults: [],
    features: [],
    gender: [],
    opinions: [],
    painPoints: [],
    recentSearchMethods: [],
    region: [],
    saveLocations: [],
  },
  kpi: {
    arrivals: 0,
    conversionRate: 0,
    pageViews: 0,
    signups: 0,
    todayArrivals: 0,
    todayPageViews: 0,
    todaySignups: 0,
  },
  recentSignups: [],
  timeline: [],
  version: "v2",
};

const adminBasePath = "";
const UNCATEGORIZED_CATEGORY_ID = "category-uncategorized";
const UNCATEGORIZED_CATEGORY_NAME = "미분류";
const KAKAO_POSTCODE_SCRIPT_ID = "kakao-postcode-script";
const KAKAO_POSTCODE_SCRIPT_SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const CORE_MOOD_TAGS = ["차분한", "아늑한", "밝은", "세련된", "개성있는", "활기있는"];
const CORE_SITUATION_TAGS = ["데이트", "친구랑", "혼자/작업공부", "가볍게", "특별한 날"];
const CORE_TIME_TAGS: string[] = [];
const CORE_TAGS_BY_KIND: Record<ContentTagKind, string[]> = {
  mood: CORE_MOOD_TAGS,
  situation: CORE_SITUATION_TAGS,
  time: CORE_TIME_TAGS,
};

function adminApiPath(path: string) {
  return `${adminBasePath}${path}`;
}

function adminAssetPath(path: string) {
  return `/admin${path}`;
}

function loadKakaoPostcodeScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 주소 검색을 열 수 있습니다."));
  if (window.kakao?.Postcode) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(KAKAO_POSTCODE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.id = KAKAO_POSTCODE_SCRIPT_ID;
    script.src = KAKAO_POSTCODE_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

function selectedPostcodeAddress(data: KakaoPostcodeData) {
  const primaryAddress = data.userSelectedType === "J"
    ? data.jibunAddress
    : data.roadAddress || data.address;
  return (primaryAddress || data.address || data.roadAddress || data.jibunAddress || "").trim();
}

type SurveyQuestion = {
  description: string;
  id: string;
  label: string;
  multi?: boolean;
  options: Array<{ count: number; label: string }>;
  quotes?: string[];
  title: string;
};

type SurveyRespondent = {
  age: string;
  betaCommitment: string;
  betaResult: string;
  campaignCode: string;
  contact: string;
  desiredFeatures: string[];
  email?: string;
  gender: string;
  id: string;
  name: string;
  opinion: string;
  painPoint: string;
  phone?: string;
  recentSearchMethods: string[];
  region: string;
  saveLocations: string[];
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  arrow: (
    <Icon>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </Icon>
  ),
  camera: (
    <Icon>
      <path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  ),
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Icon>
  ),
  funnel: (
    <Icon>
      <path d="M3 5h18l-7 8v5l-4 2v-7z" />
    </Icon>
  ),
  image: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-4.5-4.5L7 20" />
    </Icon>
  ),
  lock: (
    <Icon>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  ),
  plus: (
    <Icon>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.05.05a2 2 0 0 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.87l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.05-.05a2 2 0 0 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.2.48.79 1 1.56 1H21a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1z" />
    </Icon>
  ),
  store: (
    <Icon>
      <path d="M4 10h16" />
      <path d="M5 10l1-6h12l1 6" />
      <path d="M6 10v10h12V10" />
      <path d="M9 20v-5h6v5" />
    </Icon>
  ),
  users: (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
};

const navItems: NavItem[] = [
  { description: "핵심 숫자", icon: icons.dashboard, id: "dashboard", label: "대시보드" },
  {
    description: "유입부터 공유까지",
    icon: icons.funnel,
    id: "funnel",
    label: "퍼널",
    subTabs: [
      { id: "funnel_overview", label: "전체 퍼널" },
      { id: "ad_tests", label: "광고 테스트" },
      { id: "share_links", label: "공유 링크 성과" },
    ],
  },
  {
    description: "앱 이용자",
    icon: icons.users,
    id: "users",
    label: "유저",
    subTabs: [
      { id: "user_list", label: "유저 목록" },
      { id: "waitlist", label: "알림신청자" },
      { id: "waitlist_survey", label: "알림신청 설문" },
      { id: "saved_places", label: "저장한 장소" },
      { id: "created_routes", label: "만든 루트" },
      { id: "activity_logs", label: "행동 로그" },
    ],
  },
  {
    description: "콘텐츠 공급",
    icon: icons.camera,
    id: "creators",
    label: "사진제공자",
    subTabs: [
      { id: "creator_list", label: "제공자 목록" },
      { id: "creator_photos", label: "제공 사진" },
      { id: "creator_contacts", label: "컨택 상태" },
    ],
  },
  {
    description: "장소와 제휴",
    icon: icons.store,
    id: "stores",
    label: "가게",
    subTabs: [
      { id: "store_list", label: "가게 목록" },
      { id: "store_contacts", label: "가게 컨택" },
      { id: "partnership_status", label: "제휴/제외 상태" },
    ],
  },
  {
    description: "사진/태그 검수",
    icon: icons.image,
    id: "content",
    label: "콘텐츠",
    subTabs: [
      { id: "photo_review", label: "장소카드 관리" },
      { id: "scrap_management", label: "스크랩 관리" },
      { id: "photo_management", label: "사진관리" },
      { id: "tag_management", label: "태그관리" },
    ],
  },
  { description: "관리자/시스템", icon: icons.settings, id: "settings", label: "설정" },
];

function defaultActiveSubTabs(): Record<TabId, SubTabId | null> {
  return {
    content: "photo_review",
    creators: "creator_list",
    dashboard: null,
    funnel: "funnel_overview",
    settings: null,
    stores: "store_list",
    users: "user_list",
  };
}

function navItemByTab(tabId: TabId) {
  return navItems.find((item) => item.id === tabId);
}

function isTabId(value: string | undefined): value is TabId {
  return Boolean(value && navItems.some((item) => item.id === value));
}

function validSubTabFor(tabId: TabId, value: string | undefined): SubTabId | null {
  const item = navItemByTab(tabId);
  const subTab = item?.subTabs?.find((candidate) => candidate.id === value);
  return subTab?.id ?? null;
}

function currentAdminRouteBasePath(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
  if (adminBasePath) return adminBasePath;
  return pathname === "/admin" || pathname.startsWith("/admin/") ? "/admin" : "";
}

function stripAdminBasePath(pathname: string) {
  const routeBasePath = currentAdminRouteBasePath(pathname);
  if (!routeBasePath) return pathname;
  return pathname === routeBasePath ? "/" : pathname.startsWith(`${routeBasePath}/`) ? pathname.slice(routeBasePath.length) : pathname;
}

function adminRoutePath(tabId: TabId, subTabId: SubTabId | null) {
  const suffix = subTabId ? `/${subTabId}` : "";
  return `${currentAdminRouteBasePath()}/${tabId}${suffix}`.replace(/\/{2,}/g, "/");
}

function initialAdminNavState() {
  const activeSubTabs = defaultActiveSubTabs();
  if (typeof window === "undefined") return { activeSubTabs, activeTab: "dashboard" as TabId };

  const parts = stripAdminBasePath(window.location.pathname).split("/").filter(Boolean);
  const tab = isTabId(parts[0]) ? parts[0] : "dashboard";
  const subTab = validSubTabFor(tab, parts[1]) ?? activeSubTabs[tab] ?? null;
  activeSubTabs[tab] = subTab;

  return { activeSubTabs, activeTab: tab };
}

function DoripeLogo() {
  return <img alt="" aria-hidden="true" className="doripe-logo-img" src={adminAssetPath("/doripe-logo.png")} />;
}

function LoadingSpinner({ label }: { label?: string }) {
  return (
    <span className="loading-inline">
      <span className="loading-spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

function ActionBusyPanel({ label }: { label: string }) {
  return (
    <div className="action-busy-panel" role="status" aria-live="polite">
      <LoadingSpinner label={label} />
    </div>
  );
}

function GlobalLoadingBar({ label }: { label: string }) {
  return (
    <div className="global-loading-bar" role="status" aria-live="polite" aria-label={label}>
      <span />
    </div>
  );
}

function AdminLoadingSkeleton() {
  return (
    <div className="admin-skeleton" aria-label="관리자 데이터 불러오는 중" role="status">
      <div className="skeleton-card skeleton-wide">
        <span className="skeleton-line w-25" />
        <span className="skeleton-line w-60" />
        <span className="skeleton-line w-40" />
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="skeleton-card" key={index}>
            <span className="skeleton-line w-40" />
            <span className="skeleton-line w-70" />
            <span className="skeleton-block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({
  actions,
  children,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {actions ? <div className="card-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, index) => <td key={`${rowIndex}-${index}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionIntro({ actions }: {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return actions ? <div className="section-actions-only">{actions}</div> : null;
}

function ActionButtons({
  addLabel = "추가",
  editLabel = "수정",
  onAdd,
  onEdit,
}: {
  addLabel?: string;
  editLabel?: string;
  onAdd: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="action-row">
      {onEdit ? <button className="btn ghost" type="button" onClick={onEdit}>{editLabel}</button> : null}
      <button className="btn primary" type="button" onClick={onAdd}>{icons.plus}{addLabel}</button>
    </div>
  );
}

function FormPreview({ fields }: { fields: string[] }) {
  return (
    <div className="form-preview">
      {fields.map((field) => (
        <label className="form-field-preview" key={field}>
          <span>{field}</span>
          <input placeholder={`${field} 입력`} />
        </label>
      ))}
    </div>
  );
}

function ProviderFormPreview({ mode }: { mode: "add" | "edit" }) {
  return (
    <div className="form-preview">
      <label className="form-field-preview">
        <span>제공자 이름</span>
        <input placeholder="제공자 이름 입력" />
      </label>
      <label className="form-field-preview">
        <span>유형</span>
        <select defaultValue="큐레이터">
          <option>가게</option>
          <option>큐레이터</option>
        </select>
      </label>
      {mode === "edit" ? (
        <label className="form-field-preview">
          <span>장소</span>
          <input placeholder="연결 장소 입력" />
        </label>
      ) : null}
    </div>
  );
}

function StatusSelect({ options = contactStatuses, value }: { options?: string[]; value: string }) {
  return (
    <select className="status-select" defaultValue={value}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function fmtNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

const funnelChartPeriods: Array<{ id: FunnelChartPeriod; label: string; short: string }> = [
  { id: "day", label: "일별", short: "D" },
  { id: "week", label: "주별", short: "W" },
  { id: "month", label: "월별", short: "M" },
];

function timelineDate(bucket: string) {
  const [year = "0", month = "1", day = "1"] = bucket.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function fullDateLabel(date: Date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMondayWeek(date: Date) {
  const next = new Date(date);
  const mondayOffset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - mondayOffset);
  return next;
}

function aggregateFunnelTimeline(timeline: AdminStats["timeline"], period: FunnelChartPeriod): FunnelChartRow[] {
  if (period === "day") {
    return timeline.map((row) => {
      const date = timelineDate(row.bucket);
      return {
        ...row,
        label: shortDateLabel(date),
        tooltipLabel: fullDateLabel(date),
      };
    });
  }

  const groups = new Map<string, FunnelChartRow>();
  for (const row of timeline) {
    const date = timelineDate(row.bucket);
    const groupDate = period === "week" ? startOfMondayWeek(date) : new Date(date.getFullYear(), date.getMonth(), 1);
    const key = period === "week" ? dateKey(groupDate) : `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, "0")}`;
    const existing = groups.get(key);
    if (existing) {
      existing.notifyArrivals += row.notifyArrivals;
      existing.pageViews += row.pageViews;
      existing.signups += row.signups;
      continue;
    }

    groups.set(key, {
      bucket: key,
      label: period === "week" ? `${shortDateLabel(groupDate)}주` : `${groupDate.getFullYear()}.${groupDate.getMonth() + 1}`,
      notifyArrivals: row.notifyArrivals,
      pageViews: row.pageViews,
      signups: row.signups,
      tooltipLabel: period === "week" ? `${fullDateLabel(groupDate)} 주` : `${groupDate.getFullYear()}년 ${groupDate.getMonth() + 1}월`,
    });
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, row]) => row);
}

function formatDate(value: string | Date | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getCreatorKey(item: CreatorSubmission) {
  return item.creator_profiles?.id
    ?? item.creator_profiles?.email
    ?? item.creator_profiles?.instagram_url
    ?? item.id;
}

function getCreatorName(item: CreatorSubmission) {
  return item.creator_profiles?.display_name
    ?? item.creator_profiles?.instagram_url
    ?? item.creator_profiles?.email
    ?? "이름 없는 제공자";
}

function getCreatorHandle(item: CreatorSubmission) {
  const instagram = item.creator_profiles?.instagram_url;
  if (instagram) return instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "");
  return item.creator_profiles?.email ?? "채널 미등록";
}

function buildCreatorPhotoProviders(submissions: CreatorSubmission[]) {
  const providers = new Map<string, CreatorPhotoProvider>();

  for (const submission of submissions) {
    const key = getCreatorKey(submission);
    const current = providers.get(key) ?? {
      handle: getCreatorHandle(submission),
      key,
      name: getCreatorName(submission),
      photoCount: 0,
      placeCount: 0,
      providerType: "큐레이터" as const,
      submissions: [],
    };

    current.submissions.push(submission);
    current.photoCount += submission.creator_submission_photos?.filter((photo) => photo.signed_url).length ?? 0;
    current.placeCount = new Set(current.submissions.map((item) => item.place_name ?? "장소 미정")).size;
    providers.set(key, current);
  }

  return Array.from(providers.values()).sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name, "ko"));
}

function buildDoripePlacePhotoGroups(data: OpsData): CreatorPlacePhotoGroup[] {
  return data.places
    .map((place) => {
      const photos = getAppPhotos(place)
        .filter((photo) => {
          const isTeamPhoto = photo.source_type === "team" || photo.rights_holder_name === "Doripe";
          const isLegacyTeamPhoto = !photo.source_type && place.image_credit === "team";
          return photo.public_url && (isTeamPhoto || isLegacyTeamPhoto);
        })
        .map((photo, index) => ({
          created_at: place.last_checked_at ?? undefined,
          id: photo.id ?? `${place.id}-doripe-${index}`,
          review_status: photo.permission_status ?? place.photo_qa_status,
          selected_for_card: true,
          signed_url: photo.public_url,
        }));

      return {
        category: place.category_id ?? "유형 미정",
        latestAt: place.last_checked_at ?? "",
        name: place.name ?? "장소 미정",
        photos,
        status: place.status ?? "draft",
        submissionIds: [place.id],
      };
    })
    .filter((place) => place.photos.length > 0)
    .sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name, "ko"));
}

function buildDoripePhotoProvider(data: OpsData): CreatorPhotoProvider {
  const placeGroups = buildDoripePlacePhotoGroups(data);
  return {
    handle: "관리자용 기본 제공자",
    key: "doripe-default",
    name: "Doripe",
    photoCount: placeGroups.reduce((sum, place) => sum + place.photos.length, 0),
    placeCount: placeGroups.length,
    placeGroups,
    providerType: "Doripe",
    submissions: [],
  };
}

function buildNaverPlacePhotoGroups(data: OpsData): CreatorPlacePhotoGroup[] {
  return data.places
    .map((place) => {
      const photos = getAppPhotos(place)
        .filter((photo) => {
          const isNaverPhoto = photo.source_type === "naver" || photo.rights_holder_name === "Naver";
          const isLegacyNaverPhoto = !photo.source_type && place.image_credit === "naver";
          return photo.public_url && (isNaverPhoto || isLegacyNaverPhoto);
        })
        .map((photo, index) => ({
          created_at: place.last_checked_at ?? undefined,
          id: photo.id ?? `${place.id}-naver-${index}`,
          review_status: photo.permission_status ?? place.photo_qa_status,
          selected_for_card: true,
          signed_url: photo.public_url,
        }));

      return {
        category: place.category_id ?? "유형 미정",
        latestAt: place.last_checked_at ?? "",
        name: place.name ?? "장소 미정",
        photos,
        status: place.status ?? "draft",
        submissionIds: [place.id],
      };
    })
    .filter((place) => place.photos.length > 0)
    .sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name, "ko"));
}

function buildNaverPhotoProvider(data: OpsData): CreatorPhotoProvider {
  const placeGroups = buildNaverPlacePhotoGroups(data);
  return {
    handle: "네이버 지도/플레이스",
    key: "naver-default",
    name: "Naver",
    photoCount: placeGroups.reduce((sum, place) => sum + place.photos.length, 0),
    placeCount: placeGroups.length,
    placeGroups,
    providerType: "Naver",
    submissions: [],
  };
}

function buildPhotoProviderOptions(submissions: CreatorSubmission[]): PhotoProviderOption[] {
  const creatorOptions = buildCreatorPhotoProviders(submissions).map((provider) => ({
    key: `creator:${provider.key}`,
    label: provider.name,
    meta: provider.handle,
    sourceType: "creator" as const,
  }));

  // Keep this list in lockstep with "사진제공자". Doripe and Naver are system providers;
  // creator rows come from submitted creator data.
  return [
    { key: "team:doripe", label: "Doripe", meta: "내부 촬영", sourceType: "team" as const },
    { key: "naver:map", label: "Naver", meta: "네이버 지도/플레이스", sourceType: "naver" as const },
    ...creatorOptions,
  ];
}

function buildCreatorPlacePhotoGroups(submissions: CreatorSubmission[]) {
  const places = new Map<string, CreatorPlacePhotoGroup>();

  for (const submission of submissions) {
    const name = submission.place_name ?? "장소 미정";
    const category = submission.place_category ?? "유형 미정";
    const key = `${name}__${category}`;
    const photos = submission.creator_submission_photos?.filter((photo) => photo.signed_url) ?? [];
    const current = places.get(key) ?? {
      category,
      latestAt: submission.created_at ?? "",
      name,
      photos: [],
      status: submission.status ?? "상태 미정",
      submissionIds: [],
    };

    current.photos.push(...photos);
    current.submissionIds.push(submission.id);
    current.latestAt = [current.latestAt, submission.created_at ?? ""].sort().at(-1) ?? "";
    current.status = submission.status ?? current.status;
    places.set(key, current);
  }

  return Array.from(places.values());
}

function EmptyState({ label = "연결된 실제 데이터가 없습니다." }: { label?: string }) {
  return <div className="empty-state">{label}</div>;
}

function formatNeighborhood(id: string | undefined, items: OpsData["neighborhoods"]) {
  return items.find((item) => item.id === id)?.name ?? id ?? "미지정";
}

function formatCategory(id: string | undefined, items: OpsData["categories"]) {
  const category = items.find((item) => item.id === id);
  if (category && !isUncategorizedCategory(category)) return category.name;
  return UNCATEGORIZED_CATEGORY_NAME;
}

function isUncategorizedCategory(category: { id?: string; name?: string } | undefined) {
  return category?.id === UNCATEGORIZED_CATEGORY_ID || category?.name === UNCATEGORIZED_CATEGORY_NAME;
}

function normalCategoryOptions(categories: OpsData["categories"]) {
  return categories.filter((category) => !isUncategorizedCategory(category));
}

function categoryOptionsWithFallback(categories: OpsData["categories"]) {
  const uncategorized = categories.find(isUncategorizedCategory)
    ?? { id: UNCATEGORIZED_CATEGORY_ID, name: UNCATEGORIZED_CATEGORY_NAME };
  return [...normalCategoryOptions(categories), uncategorized];
}

function normalizePlaceCategoryId(categoryId: string | undefined, categories: OpsData["categories"]) {
  const category = categories.find((item) => item.id === categoryId);
  if (category && !isUncategorizedCategory(category)) return category.id;
  return UNCATEGORIZED_CATEGORY_ID;
}

function getPlacePhotoCount(place: PlaceRow) {
  const appPhotos = getAppPhotos(place);
  if (appPhotos.length) return appPhotos.length;
  const images = new Set([place.cover_image_url, ...(place.image_urls ?? [])].filter(Boolean));
  return images.size;
}

function getAppPhotos(place: PlaceRow | undefined): PlacePhotoRow[] {
  if (!place) return [];

  const photos = (place.place_photos ?? [])
    .filter((photo) => photo.public_url && (photo.photo_type === "cover" || photo.photo_type === "gallery"))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  if (photos.length) return photos;

  return [place.cover_image_url, ...(place.image_urls ?? [])]
    .filter((url): url is string => Boolean(url))
    .map((url, index) => ({
      display_order: index,
      photo_type: index === 0 ? "cover" as const : "gallery" as const,
      public_url: url,
    }));
}

function isCoverPhoto(place: PlaceRow | undefined, photo: PlacePhotoRow | undefined) {
  if (!place || !photo?.public_url) return false;
  if (place.cover_photo_id && photo.id) return place.cover_photo_id === photo.id;
  return place.cover_image_url === photo.public_url;
}

function getCoverPhoto(place: PlaceRow | undefined, photos: PlacePhotoRow[]) {
  return photos.find((photo) => isCoverPhoto(place, photo)) ?? photos[0];
}

function getPhotoKey(photo: PlacePhotoRow | undefined) {
  return photo?.id ?? photo?.public_url ?? "";
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizePhotoCrop(photo: PlacePhotoRow | undefined, draft?: PhotoCrop): PhotoCrop {
  if (draft) return draft;
  return {
    x: clampNumber(Number(photo?.crop_x ?? 50), 0, 100),
    y: clampNumber(Number(photo?.crop_y ?? 50), 0, 100),
    zoom: clampNumber(Number(photo?.crop_zoom ?? 1), 1, 3),
  };
}

function photoCropStyle(crop: PhotoCrop) {
  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${crop.zoom})`,
  };
}

function isPublishedPhoto(photo: PlacePhotoRow | undefined) {
  if (!photo?.public_url) return false;
  return photo.permission_status === "approved" || (!photo.id && photo.photo_type !== "original" && photo.photo_type !== "rights");
}

function getPublishedPhotos(photos: PlacePhotoRow[]) {
  return photos
    .filter(isPublishedPhoto)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .slice(0, 5);
}

function getPublishedPhotoSlotMap(photos: PlacePhotoRow[]) {
  const slotMap = new Map<string, number>();
  getPublishedPhotos(photos).forEach((photo, index) => {
    const key = getPhotoKey(photo);
    if (key) slotMap.set(key, index + 1);
  });
  return slotMap;
}

function placeStatusLabel(status: PlaceRow["status"] | undefined) {
  if (status === "ready") return "게시";
  if (status === "inactive") return "비활성";
  return "대기";
}

function placeStatusClass(status: PlaceRow["status"] | undefined) {
  if (status === "ready") return "is-ready";
  if (status === "inactive") return "is-inactive";
  return "is-draft";
}

function PlaceStatusToggle({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (status: "draft" | "ready") => void;
  value: PlaceRow["status"] | undefined;
}) {
  const isReady = value === "ready";

  return (
    <button
      aria-pressed={isReady}
      className={`place-status-toggle ${isReady ? "is-ready" : ""}`}
      disabled={disabled}
      type="button"
      onClick={() => onChange(isReady ? "draft" : "ready")}
    >
      <span className="place-status-toggle-track"><span /></span>
      <strong>{isReady ? "게시 중" : "대기 중"}</strong>
    </button>
  );
}

function orderedImageUrlsForCover(photos: PlacePhotoRow[], coverPhoto: PlacePhotoRow | undefined) {
  const urls = photos.map((photo) => photo.public_url).filter((url): url is string => Boolean(url));
  if (!coverPhoto?.public_url) return urls;

  return [coverPhoto.public_url, ...urls.filter((url) => url !== coverPhoto.public_url)];
}

function listToCsv(value: string[] | undefined) {
  return (value ?? []).join(", ");
}

function csvToList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueSortedTags(places: PlaceRow[], field: "best_for" | "mood_tags" | "time_tags") {
  return Array.from(new Set(places.flatMap((place) => place[field] ?? []))).sort((a, b) => a.localeCompare(b, "ko"));
}

const tagFieldByKind: Record<ContentTagKind, "best_for" | "mood_tags" | "time_tags"> = {
  mood: "mood_tags",
  situation: "best_for",
  time: "time_tags",
};

function getManagedTags(data: OpsData, kind: ContentTagKind, _field: "best_for" | "mood_tags" | "time_tags") {
  const registryTags = data.contentTags
    .filter((tag) => tag.kind === kind && tag.status !== "inactive")
    .map((tag) => tag.name);
  const baseTags = CORE_TAGS_BY_KIND[kind] ?? [];
  return Array.from(new Set([...baseTags, ...registryTags]))
    .sort((a, b) => {
      const leftOrder = baseTags.indexOf(a);
      const rightOrder = baseTags.indexOf(b);
      if (leftOrder >= 0 || rightOrder >= 0) {
        return (leftOrder >= 0 ? leftOrder : Number.MAX_SAFE_INTEGER) - (rightOrder >= 0 ? rightOrder : Number.MAX_SAFE_INTEGER);
      }
      return a.localeCompare(b, "ko");
    });
}

function findManagedTag(data: OpsData, kind: ContentTagKind, name: string) {
  return data.contentTags.find((tag) => tag.kind === kind && tag.name === name && tag.status !== "inactive");
}

function makePlaceDraft(place: PlaceRow | undefined, data: OpsData) {
  const fallbackCategoryId = categoryOptionsWithFallback(data.categories)[0]?.id ?? UNCATEGORIZED_CATEGORY_ID;
  return {
    address: place?.address ?? "",
    best_for: listToCsv(place?.best_for),
    category_id: place ? normalizePlaceCategoryId(place.category_id, data.categories) : fallbackCategoryId,
    editorial_note: place?.editorial_note ?? "",
    hours_text: place?.hours_text ?? "",
    instagram_url: place?.instagram_url ?? "",
    id: place?.id ?? "",
    image_credit: place?.image_credit ?? "team",
    lat: String(place?.lat ?? 0),
    lng: String(place?.lng ?? 0),
    mood_tags: listToCsv(place?.mood_tags),
    name: place?.name ?? "",
    naver_place_url: place?.naver_place_url ?? "",
    nearest_station: place?.nearest_station ?? "",
    neighborhood_id: place?.neighborhood_id ?? data.neighborhoods[0]?.id ?? "unknown",
    photo_qa_status: place?.photo_qa_status ?? "pending",
    phone_text: place?.phone_text ?? "",
    price_hint: place?.price_hint ?? "",
    qa_status: place?.qa_status ?? "draft",
    representative_menu_name: place?.representative_menu_name ?? "",
    representative_menu_price: place?.representative_menu_price ?? "",
    route_role: place?.route_role ?? "middle",
    short_copy: place?.short_copy ?? "",
    status: place?.status ?? "draft",
    stay_time_minutes: String(place?.stay_time_minutes ?? 45),
    sub_area: place?.sub_area ?? "",
    time_tags: listToCsv(place?.time_tags),
  };
}

function placeDraftSignature(draft: ReturnType<typeof makePlaceDraft>) {
  return JSON.stringify(draft);
}

function makePlacePayloadFromRow(
  place: PlaceRow,
  data: OpsData,
  overrides: Partial<Pick<PlaceRow, "best_for" | "category_id" | "mood_tags" | "time_tags">> = {},
) {
  const merged = { ...place, ...overrides };
  const imageUrls = getAppPhotos(place).map((photo) => photo.public_url).filter(Boolean);
  const fallbackCategoryId = categoryOptionsWithFallback(data.categories)[0]?.id ?? UNCATEGORIZED_CATEGORY_ID;

  return {
    address: merged.address ?? "",
    best_for: merged.best_for ?? [],
    category_id: merged.category_id ? normalizePlaceCategoryId(merged.category_id, data.categories) : fallbackCategoryId,
    cover_image_url: imageUrls[0] ?? merged.cover_image_url ?? "",
    editorial_note: merged.editorial_note ?? "",
    hours_text: merged.hours_text ?? "",
    instagram_url: merged.instagram_url ?? "",
    id: place.id,
    image_credit: merged.image_credit ?? "team",
    image_urls: imageUrls,
    cover_photo_id: merged.cover_photo_id ?? null,
    last_checked_at: merged.last_checked_at ?? null,
    lat: merged.lat ?? 0,
    lng: merged.lng ?? 0,
    mood_tags: merged.mood_tags ?? [],
    name: merged.name ?? "",
    naver_place_url: merged.naver_place_url ?? "",
    nearest_station: merged.nearest_station ?? "",
    neighborhood_id: merged.neighborhood_id ?? data.neighborhoods[0]?.id ?? "unknown",
    photo_qa_status: merged.photo_qa_status ?? "pending",
    phone_text: merged.phone_text ?? "",
    price_hint: merged.price_hint ?? "",
    qa_status: merged.qa_status ?? "draft",
    representative_menu_name: merged.representative_menu_name ?? "",
    representative_menu_price: merged.representative_menu_price ?? "",
    route_role: merged.route_role ?? "middle",
    short_copy: merged.short_copy ?? "",
    status: merged.status ?? "draft",
    stay_time_minutes: merged.stay_time_minutes ?? 45,
    sub_area: merged.sub_area ?? "",
    time_tags: merged.time_tags ?? [],
  };
}

function TagChoiceGroup({
  helperText,
  label,
  max,
  multiple = true,
  onChange,
  options,
  value,
}: {
  helperText?: string;
  label: string;
  max?: number;
  multiple?: boolean;
  onChange: (value: string[]) => void;
  options: string[];
  value: string[];
}) {
  function toggle(option: string) {
    if (!multiple) {
      onChange([option]);
      return;
    }

    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }

    if (max && value.length >= max) {
      return;
    }

    onChange([...value, option]);
  }

  return (
    <div className="choice-group">
      <span>{label}</span>
      <div className="choice-chip-row">
        {options.length ? options.map((option) => (
          <button
            className={value.includes(option) ? "is-selected" : ""}
            key={option}
            type="button"
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        )) : <em>태그 관리에 등록된 태그가 없습니다.</em>}
      </div>
      {helperText ? <em className="choice-helper">{helperText}</em> : null}
    </div>
  );
}

function AddressSearchOverlay({
  initialQuery,
  onClose,
  onSelect,
}: {
  initialQuery?: string;
  onClose: () => void;
  onSelect: (address: string, data: KakaoPostcodeData) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function openAddressSearch() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadKakaoPostcodeScript();
        if (!isMounted || !containerRef.current || !window.kakao?.Postcode) return;

        containerRef.current.innerHTML = "";
        const postcode = new window.kakao.Postcode({
          height: "100%",
          maxSuggestItems: 5,
          oncomplete: (data) => {
            const address = selectedPostcodeAddress(data);
            if (!address) {
              setErrorMessage("선택한 주소 값을 읽지 못했습니다. 다른 검색 결과를 선택해 주세요.");
              return;
            }
            onSelect(address, data);
          },
          theme: {
            bgColor: "#ffffff",
            emphTextColor: "#10b981",
            outlineColor: "#d7ddd3",
            pageBgColor: "#f7f8f2",
            queryTextColor: "#0f172a",
            searchBgColor: "#ffffff",
            textColor: "#0f172a",
          },
          width: "100%",
        });

        postcode.embed(containerRef.current, initialQuery?.trim() ? { q: initialQuery.trim() } : undefined);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "주소 검색을 열지 못했습니다.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void openAddressSearch();

    return () => {
      isMounted = false;
    };
  }, [initialQuery, onSelect]);

  return (
    <div className="modal-backdrop address-search-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="address-search-modal" role="dialog" aria-modal="true" aria-labelledby="address-search-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 id="address-search-title">도로명주소 찾기</h2>
            <p>도로명, 건물명, 지번을 검색하고 결과를 선택하면 주소가 자동 입력됩니다.</p>
          </div>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        {errorMessage ? <div className="inline-warning">{errorMessage}</div> : null}
        {isLoading ? <div className="address-search-loading">주소 검색을 불러오는 중...</div> : null}
        <div className="address-search-frame" ref={containerRef} />
      </section>
    </div>
  );
}

function ProviderSearchOverlay({
  isSaving,
  onClose,
  onQueryChange,
  onSelect,
  options,
  photo,
  query,
  selectedProviderKey,
}: {
  isSaving: boolean;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (provider: PhotoProviderOption) => void;
  options: PhotoProviderOption[];
  photo?: PlacePhotoRow;
  query: string;
  selectedProviderKey?: string;
}) {
  const sourceLabelByType: Record<PhotoProviderOption["sourceType"], string> = {
    creator: "큐레이터",
    licensed: "라이선스",
    naver: "Naver",
    owner: "가게",
    team: "Doripe",
  };

  return (
    <div className="modal-backdrop provider-search-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="provider-search-modal" role="dialog" aria-modal="true" aria-labelledby="provider-search-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 id="provider-search-title">사진제공자 찾기</h2>
            <p>검색하거나 스크롤해서 선택하면 현재 사진의 제공자로 저장됩니다.</p>
          </div>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <div className="provider-search-layout">
          <aside className="provider-search-preview">
            <div className="provider-search-image" style={{ backgroundImage: photo?.public_url ? `url(${photo.public_url})` : undefined }} />
            <div className="provider-search-preview-copy">
              <span>선택 사진</span>
              <strong>{photo?.rights_holder_name ?? "제공자 미지정"}</strong>
              <em>{photo?.source_type ? sourceLabelByType[photo.source_type] : "출처 미지정"}</em>
            </div>
          </aside>
          <section className="provider-search-results">
            <input
              autoFocus
              className="library-search"
              placeholder="Doripe, Naver, 가게, 큐레이터 이름 검색"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <div className="provider-search-list">
              {options.length ? options.map((provider) => (
                <button
                  className={selectedProviderKey === provider.key ? "is-selected" : ""}
                  disabled={isSaving}
                  key={provider.key}
                  type="button"
                  onClick={() => onSelect(provider)}
                >
                  <span className="provider-avatar">{provider.label.slice(0, 1)}</span>
                  <span className="provider-copy">
                    <strong>{provider.label}</strong>
                    <em>{provider.meta}</em>
                  </span>
                  <small>{sourceLabelByType[provider.sourceType]}</small>
                </button>
              )) : <EmptyState label="검색된 사진제공자가 없습니다." />}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

async function ensureUncategorizedCategory(data: OpsData) {
  const existing = data.categories.find(isUncategorizedCategory);
  if (existing) return existing.id;

  const response = await fetch(adminApiPath("/api/admin/categories"), {
    body: JSON.stringify({
      display_order: 9999,
      id: UNCATEGORIZED_CATEGORY_ID,
      name: UNCATEGORIZED_CATEGORY_NAME,
      status: "active",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "미분류 장소 유형 생성에 실패했습니다.");
  }

  return UNCATEGORIZED_CATEGORY_ID;
}

function NaverPlaceImportForm({
  data,
  onCancel,
  onCreated,
}: {
  data: OpsData;
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [neighborhoodId, setNeighborhoodId] = useState(data.neighborhoods.find((item) => item.name.includes("연남"))?.id ?? data.neighborhoods[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const categoryOptions = normalCategoryOptions(data.categories);

  async function submit() {
    if (!url.trim()) {
      setMessage("네이버지도 링크를 입력해야 합니다.");
      return;
    }
    if (!neighborhoodId) {
      setMessage("동네를 선택해야 합니다.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/naver-place-import"), {
        body: JSON.stringify({
          category_id: categoryId,
          neighborhood_id: neighborhoodId,
          url: url.trim(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      const body = await response.json().catch(() => null) as { imported?: { photoCount?: number }; message?: string } | null;
      if (!response.ok) {
        setMessage(body?.message ?? "네이버 장소 가져오기에 실패했습니다.");
        return;
      }

      await onCreated();
      onCancel();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="naver-place-import-form">
      <label>
        <span>네이버지도 링크</span>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://naver.me/... 또는 네이버 플레이스 URL"
        />
      </label>
      <label>
        <span>동네</span>
        <select value={neighborhoodId} onChange={(event) => setNeighborhoodId(event.target.value)}>
          {data.neighborhoods.map((neighborhood) => <option key={neighborhood.id} value={neighborhood.id}>{neighborhood.name}</option>)}
        </select>
      </label>
      <label>
        <span>장소 유형</span>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">네이버 카테고리로 자동 분류</option>
          {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <div className="naver-import-note">
        <strong>가져오는 항목</strong>
        <span>장소명, 주소, 카테고리, 대표메뉴, 전화번호, 네이버 URL, 사진 최대 5장</span>
      </div>
      {message ? <div className="inline-warning">{message}</div> : null}
      <div className="modal-inline-actions">
        <button className="btn ghost" disabled={isSaving} type="button" onClick={onCancel}>취소</button>
        <button className="btn primary" disabled={isSaving} type="button" onClick={() => void submit()}>
          {isSaving ? <LoadingSpinner label="가져오는 중" /> : "네이버 장소 가져오기"}
        </button>
      </div>
    </div>
  );
}

function ScrapManagementView() {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const previews = useMemo(() => files.slice(0, 6).map((file) => ({
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
  })), [files]);

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  function addFiles(nextFiles: File[]) {
    const imageFiles = nextFiles.filter((file) => file.type.startsWith("image/"));
    setFiles((current) => [...current, ...imageFiles].slice(0, 20));
    if (nextFiles.length !== imageFiles.length) {
      setMessage("이미지 파일만 추가했습니다.");
    }
  }

  async function submit() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setMessage("네이버지도 URL을 입력해야 합니다.");
      return;
    }
    if (!files.length) {
      setMessage("사진을 1장 이상 올려야 합니다.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("url", trimmedUrl);
      files.forEach((file) => formData.append("photos", file));

      const response = await fetch(adminApiPath("/api/admin/scrap-submissions"), {
        body: formData,
        method: "POST",
      });
      const body = await response.json().catch(() => null) as { message?: string; submission?: { file_count?: number } } | null;
      if (!response.ok) {
        setMessage(body?.message ?? "스크랩 제출에 실패했습니다.");
        return;
      }

      setUrl("");
      setFiles([]);
      setMessage(`제출 완료: 사진 ${body?.submission?.file_count ?? files.length}장이 스크랩 큐에 들어갔습니다.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <SectionIntro eyebrow="Content" title="스크랩 관리" description="네이버지도 URL과 장소 사진을 등록합니다." />
      <div className="scrap-management-shell">
        <Card
          actions={<span className="status-pill count-pill">{files.length}장 선택</span>}
          eyebrow="Scrap intake"
          title="네이버지도 URL · 사진 제출"
        >
          <div className="scrap-submit-form">
            <label className="scrap-url-field">
              <span>네이버지도 URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://naver.me/... 또는 네이버 플레이스 URL"
              />
            </label>
            <label
              className={`scrap-dropzone ${files.length ? "has-files" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <input
                accept="image/jpeg,image/png,image/webp"
                multiple
                type="file"
                onChange={(event) => {
                  addFiles(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
              <span className="scrap-dropzone-icon">{icons.image}</span>
              <strong>사진 올리기</strong>
              <em>클릭하거나 드래그해서 추가 · 장당 10MB 이하</em>
            </label>
            {previews.length ? (
              <div className="scrap-preview-grid">
                {previews.map((preview, index) => (
                  <figure key={`${preview.name}-${index}`}>
                    <img alt="" src={preview.url} />
                    <figcaption>{preview.name}</figcaption>
                  </figure>
                ))}
                {files.length > previews.length ? <span className="scrap-extra-count">+{files.length - previews.length}</span> : null}
              </div>
            ) : null}
            {message ? <div className="inline-warning">{message}</div> : null}
            <div className="scrap-submit-actions">
              <button className="btn ghost" disabled={isSubmitting || !files.length} type="button" onClick={() => setFiles([])}>
                사진 비우기
              </button>
              <button className="btn primary" disabled={isSubmitting} type="button" onClick={() => void submit()}>
                {isSubmitting ? <LoadingSpinner label="제출 중" /> : "제출"}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function PlaceAddMethodPicker({
  onDirectAdd,
  onNaverAdd,
}: {
  onDirectAdd: () => void;
  onNaverAdd: () => void;
}) {
  return (
    <div className="place-add-method-grid">
      <button className="place-add-method-card" type="button" onClick={onNaverAdd}>
        <span className="place-add-method-icon">N</span>
        <span className="place-add-method-copy">
          <strong>네이버지도 추가하기</strong>
          <em>네이버지도 링크로 장소 정보와 사진을 자동으로 가져옵니다.</em>
        </span>
        <small>링크로 가져오기</small>
      </button>
      <button className="place-add-method-card" type="button" onClick={onDirectAdd}>
        <span className="place-add-method-icon">+</span>
        <span className="place-add-method-copy">
          <strong>직접 추가하기</strong>
          <em>장소명, 주소, 유형, 태그를 직접 입력해서 새 장소카드를 만듭니다.</em>
        </span>
        <small>바로 입력</small>
      </button>
    </div>
  );
}

function PlaceCreateForm({
  data,
  onCancel,
  onCreated,
}: {
  data: OpsData;
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const categoryOptions = useMemo(() => categoryOptionsWithFallback(data.categories), [data.categories]);
  const categoryNames = categoryOptions.map((category) => category.name);
  const moodTags = getManagedTags(data, "mood", "mood_tags");
  const situationTags = getManagedTags(data, "situation", "best_for");
  const [address, setAddress] = useState("");
  const [categoryName, setCategoryName] = useState(categoryNames[0] ?? "");
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState(data.neighborhoods[0]?.id ?? "");
  const [shortCopy, setShortCopy] = useState("");
  const [situations, setSituations] = useState<string[]>([]);

  const selectAddress = useCallback((nextAddress: string, result: KakaoPostcodeData) => {
    setAddress(nextAddress);
    setIsAddressSearchOpen(false);
    setMessage(`${result.zonecode ? `${result.zonecode} · ` : ""}${nextAddress} 주소를 입력했습니다.`);
  }, []);

  async function submit() {
    const category = categoryOptions.find((item) => item.name === categoryName) ?? categoryOptions[0];
    if (!name.trim()) {
      setMessage("장소 이름을 입력해야 합니다.");
      return;
    }
    if (!category) {
      setMessage("장소 유형을 먼저 태그 관리에 등록해야 합니다.");
      return;
    }
    if (!neighborhoodId) {
      setMessage("동네를 선택해야 합니다.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const categoryId = isUncategorizedCategory(category) ? await ensureUncategorizedCategory(data) : category.id;
      const response = await fetch(adminApiPath("/api/admin/places"), {
        body: JSON.stringify({
          address,
          best_for: situations,
          category_id: categoryId,
          cover_image_url: "",
          editorial_note: "",
          hours_text: "",
          id: `place-${Date.now().toString(36)}`,
          image_credit: "team",
          image_urls: [],
          instagram_url: "",
          last_checked_at: null,
          lat: 0,
          lng: 0,
          mood_tags: moods,
          name: name.trim(),
          naver_place_url: "",
          nearest_station: "",
          neighborhood_id: neighborhoodId,
          photo_qa_status: "pending",
          phone_text: "",
          price_hint: "",
          qa_status: "draft",
          representative_menu_name: "",
          representative_menu_price: "",
          route_role: "middle",
          short_copy: shortCopy,
          status: "draft",
          stay_time_minutes: 45,
          sub_area: "",
          time_tags: [],
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.message ?? "장소카드 등록에 실패했습니다.");
        return;
      }

      await onCreated();
      onCancel();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="place-create-form">
      <label>
        <span>장소 이름</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 드라이프 카페" />
      </label>
      <label>
        <span>한줄소개</span>
        <input value={shortCopy} onChange={(event) => setShortCopy(event.target.value)} placeholder="앱 카드에 들어갈 짧은 설명" />
      </label>
      <label>
        <span>동네</span>
        <select value={neighborhoodId} onChange={(event) => setNeighborhoodId(event.target.value)}>
          {data.neighborhoods.map((neighborhood) => <option key={neighborhood.id} value={neighborhood.id}>{neighborhood.name}</option>)}
        </select>
      </label>
      <div className="address-lookup-field">
        <span>주소</span>
        <div>
          <strong>{address || "주소 미입력"}</strong>
          <button disabled={isSaving} type="button" onClick={() => setIsAddressSearchOpen(true)}>도로명주소 찾기</button>
        </div>
        <em>검색 결과를 선택하면 주소가 자동 입력됩니다.</em>
      </div>
      <TagChoiceGroup label="장소 유형" multiple={false} options={categoryNames} value={categoryName ? [categoryName] : []} onChange={(next) => setCategoryName(next[0] ?? "")} />
      <TagChoiceGroup helperText="분위기는 최대 2개까지 선택합니다." label="분위기" max={2} options={moodTags} value={moods} onChange={(next) => setMoods(next.slice(0, 2))} />
      <TagChoiceGroup label="상황" options={situationTags} value={situations} onChange={setSituations} />
      {message ? <div className="inline-warning">{message}</div> : null}
      <div className="modal-inline-actions">
        <button className="btn ghost" disabled={isSaving} type="button" onClick={onCancel}>취소</button>
        <button className="btn primary" disabled={isSaving} type="button" onClick={() => void submit()}>{isSaving ? <LoadingSpinner label="등록 중" /> : "장소카드 등록"}</button>
      </div>
      {isAddressSearchOpen ? (
        <AddressSearchOverlay
          initialQuery={address}
          onClose={() => setIsAddressSearchOpen(false)}
          onSelect={selectAddress}
        />
      ) : null}
    </div>
  );
}

function PhotoProviderEditor({
  onCancel,
  onSaved,
  photo,
  providerOptions,
}: {
  onCancel: () => void;
  onSaved: () => Promise<void>;
  photo: PlacePhotoRow;
  providerOptions: PhotoProviderOption[];
}) {
  const currentProvider = providerOptions.find((provider) => provider.label === photo.rights_holder_name)
    ?? providerOptions.find((provider) => provider.sourceType === photo.source_type)
    ?? providerOptions[0];
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [providerKey, setProviderKey] = useState(currentProvider?.key ?? "");

  async function submit() {
    if (!photo.id) {
      setMessage("DB 사진 ID가 없어 제공자를 저장할 수 없습니다.");
      return;
    }

    const provider = providerOptions.find((item) => item.key === providerKey);
    if (!provider) {
      setMessage("사진제공자를 선택해야 합니다.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/photos"), {
        body: JSON.stringify({
          credit_text: provider.meta,
          id: photo.id,
          rights_holder_name: provider.label,
          source_type: provider.sourceType,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.message ?? "사진제공자 저장에 실패했습니다.");
        return;
      }

      await onSaved();
      onCancel();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="photo-provider-editor">
      {photo.public_url ? <div className="photo-provider-preview" style={{ backgroundImage: `url(${photo.public_url})` }} /> : null}
      <label>
        <span>사진제공자</span>
        <select value={providerKey} onChange={(event) => setProviderKey(event.target.value)}>
          {providerOptions.map((provider) => (
            <option key={provider.key} value={provider.key}>{provider.label} · {provider.meta}</option>
          ))}
        </select>
      </label>
      <div className="mini-list">
        <p><strong>현재 제공자</strong><span>{photo.rights_holder_name || "미지정"}</span></p>
        <p><strong>출처 유형</strong><span>{photo.source_type || "미지정"}</span></p>
      </div>
      {message ? <div className="inline-warning">{message}</div> : null}
      <div className="modal-inline-actions">
        <button className="btn ghost" disabled={isSaving} type="button" onClick={onCancel}>취소</button>
        <button className="btn primary" disabled={isSaving} type="button" onClick={() => void submit()}>{isSaving ? <LoadingSpinner label="저장 중" /> : "저장"}</button>
      </div>
    </div>
  );
}

function buildSurveyRespondents(signups: AdminSignup[]): SurveyRespondent[] {
  return signups.map((row) => ({
    age: row.age,
    betaCommitment: row.betaCommitment,
    betaResult: row.betaResult,
    campaignCode: row.campaignCode || "-",
    contact: row.phone || row.email || "-",
    desiredFeatures: row.desiredFeatures,
    email: row.email,
    gender: row.gender,
    id: String(row.id),
    name: `응답자 ${row.id}`,
    opinion: row.opinion,
    painPoint: row.painPoint,
    phone: row.phone,
    recentSearchMethods: row.recentSearchMethods,
    region: row.region,
    saveLocations: row.saveLocations,
  }));
}

function toSurveyOptions(items: DistributionDatum[]) {
  return items.map((item) => ({ count: item.value, label: item.label }));
}

function buildSurveyQuestions(stats: AdminStats): SurveyQuestion[] {
  return [
    {
      description: "Q1 기본 정보 중 연령대 분포입니다.",
      id: "q1_age",
      label: "Q1",
      options: toSurveyOptions(stats.insights.age),
      title: "연령대",
    },
    {
      description: "Q1 기본 정보 중 성별 분포입니다.",
      id: "q1_gender",
      label: "Q1",
      options: toSurveyOptions(stats.insights.gender),
      title: "성별",
    },
    {
      description: "Q1 기본 정보 중 주 활동 지역 분포입니다.",
      id: "q1_region",
      label: "Q1",
      options: toSurveyOptions(stats.insights.region),
      title: "주 활동 지역",
    },
    {
      description: "가장 공감되는 장소 탐색 불편입니다.",
      id: "q2_pain",
      label: "Q2",
      options: toSurveyOptions(stats.insights.painPoints),
      title: "가장 공감되는 불편",
    },
    {
      description: "먼저 써보고 싶은 기능입니다. 복수 선택이라 합계가 전체 응답자 수보다 클 수 있습니다.",
      id: "q3_features",
      label: "Q3",
      multi: true,
      options: toSurveyOptions(stats.insights.features),
      title: "먼저 써보고 싶은 기능",
    },
    {
      description: "최근 갈 곳을 정할 때 실제로 쓴 방식입니다. 복수 선택입니다.",
      id: "q4_search",
      label: "Q4",
      multi: true,
      options: toSurveyOptions(stats.insights.recentSearchMethods),
      title: "최근 갈 곳을 정한 방식",
    },
    {
      description: "마음에 든 장소를 어디에 저장하는지 봅니다. 복수 선택입니다.",
      id: "q5_save",
      label: "Q5",
      multi: true,
      options: toSurveyOptions(stats.insights.saveLocations),
      title: "마음에 든 장소 저장 위치",
    },
    {
      description: "베타에서 먼저 받고 싶은 결과물입니다.",
      id: "q6_result",
      label: "Q6",
      options: toSurveyOptions(stats.insights.betaResults),
      title: "베타에서 먼저 받고 싶은 결과물",
    },
    {
      description: "베타 참여 의향의 강도를 봅니다.",
      id: "q7_commitment",
      label: "Q7",
      options: toSurveyOptions(stats.insights.betaCommitments),
      title: "베타 참여 의향",
    },
    {
      description: "마지막 자유응답입니다. 집계가 아니라 실제 응답 문장으로 확인합니다.",
      id: "q8_opinion",
      label: "Q8",
      options: [],
      quotes: stats.insights.opinions.map((item) => item.label),
      title: "자유응답",
    },
  ];
}

function DashboardView({ data, stats }: { data: OpsData; stats: AdminStats }) {
  const readyPlaces = data.places.filter((place) => place.status === "ready").length;
  const photoReadyPlaces = data.places.filter((place) => getPlacePhotoCount(place) > 0).length;

  const kpis = [
    { detail: `누적 조회 ${fmtNumber(stats.kpi.pageViews)}`, label: "오늘 유입", value: fmtNumber(stats.kpi.todayPageViews) },
    { detail: "앱 저장 이벤트 테이블 연결 전", label: "저장 수", value: "0" },
    { detail: "앱 루트 생성 이벤트 테이블 연결 전", label: "루트 생성 수", value: "0" },
    { detail: `오늘 ${fmtNumber(stats.kpi.todaySignups)}건`, label: "알림신청 수", value: fmtNumber(stats.kpi.signups) },
  ];

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Doripe Operations</span>
          <h1>환영합니다.</h1>
          <p>오늘의 유입, 저장, 루트 생성, 알림신청 흐름을 빠르게 확인하세요.</p>
        </div>
        <button className="btn primary" type="button">
          운영 리포트 {icons.arrow}
        </button>
      </section>

      <section className="kpi-grid" aria-label="핵심 지표">
        {kpis.map((kpi, index) => (
          <article className={`kpi-card tone-${index + 1}`} key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.detail}</small>
          </article>
        ))}
      </section>
      <div className="grid two">
        <Card eyebrow="Today" title="오늘 요약">
          <div className="mini-list">
            <p><strong>알림 진입</strong><span>누적 {fmtNumber(stats.kpi.arrivals)}건 · 오늘 {fmtNumber(stats.kpi.todayArrivals)}건</span></p>
            <p><strong>알림 완료</strong><span>누적 {fmtNumber(stats.kpi.signups)}건 · 오늘 {fmtNumber(stats.kpi.todaySignups)}건</span></p>
            <p><strong>조회 → 신청</strong><span>{stats.kpi.conversionRate.toFixed(1)}%</span></p>
          </div>
        </Card>
        <Card eyebrow="Content health" title="콘텐츠 현황">
          <div className="mini-list">
            <p><strong>게시 장소</strong><span>{fmtNumber(readyPlaces)}곳</span></p>
            <p><strong>사진 연결</strong><span>{fmtNumber(photoReadyPlaces)}곳</span></p>
            <p><strong>사진제공자 제출</strong><span>{fmtNumber(data.submissions.length)}건</span></p>
          </div>
        </Card>
      </div>
    </>
  );
}

function LineChartCard({ stats }: { stats: AdminStats }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [period, setPeriod] = useState<FunnelChartPeriod>("week");
  const chartRows = useMemo(() => aggregateFunnelTimeline(stats.timeline, period), [period, stats.timeline]);
  const periodLabel = funnelChartPeriods.find((item) => item.id === period)?.label ?? "주별";

  useEffect(() => {
    let chart: { destroy: () => void } | null = null;
    let isDisposed = false;

    async function renderChart() {
      if (!canvasRef.current) return;
      const { Chart, registerables } = await import("chart.js");
      if (isDisposed || !canvasRef.current) return;

      Chart.register(...registerables);
      const styles = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      const primary = token("--primary", "#10b981");
      const info = token("--info", "#0ea5e9");
      const purple = token("--purple", "#8b5cf6");
      const text = token("--t-base", "#1e293b");
      const muted = token("--t-muted", "#64748b");
      const light = token("--t-light", "#94a3b8");
      const soft = token("--border-soft", "#eef1f5");
      const bg = token("--bg-card", "#ffffff");

      Chart.defaults.font.family = "'Pretendard Variable', Pretendard, system-ui, sans-serif";
      Chart.defaults.font.size = 12;
      Chart.defaults.color = muted;
      Chart.defaults.borderColor = soft;
      Chart.defaults.plugins.legend.position = "bottom";
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.padding = 16;
      Chart.defaults.plugins.legend.labels.boxWidth = 8;
      Chart.defaults.plugins.legend.labels.boxHeight = 8;
      Chart.defaults.plugins.tooltip.backgroundColor = text;
      Chart.defaults.plugins.tooltip.titleColor = bg;
      Chart.defaults.plugins.tooltip.bodyColor = bg;
      Chart.defaults.plugins.tooltip.padding = 10;
      Chart.defaults.plugins.tooltip.cornerRadius = 6;
      Chart.defaults.plugins.tooltip.displayColors = true;

      chart = new Chart(canvasRef.current, {
        data: {
          datasets: [
            {
              backgroundColor: `${primary}20`,
              borderColor: primary,
              borderWidth: 2.5,
              data: chartRows.map((row) => row.pageViews),
              fill: true,
              label: "조회수",
              pointHoverRadius: 5,
              pointRadius: chartRows.length <= 10 ? 3 : 0,
              tension: 0.35,
            },
            {
              backgroundColor: "transparent",
              borderColor: info,
              borderWidth: 2.25,
              data: chartRows.map((row) => row.notifyArrivals),
              fill: false,
              label: "알림신청 클릭수",
              pointHoverRadius: 5,
              pointRadius: chartRows.length <= 10 ? 3 : 0,
              tension: 0.35,
            },
            {
              backgroundColor: "transparent",
              borderColor: purple,
              borderDash: [4, 4],
              borderWidth: 2.25,
              data: chartRows.map((row) => row.signups),
              fill: false,
              label: "알림신청 완료수",
              pointHoverRadius: 5,
              pointRadius: chartRows.length <= 10 ? 3 : 0,
              tension: 0.35,
            },
          ],
          labels: chartRows.map((row) => row.label),
        },
        options: {
          interaction: {
            intersect: false,
            mode: "index",
          },
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            tooltip: {
              callbacks: {
                afterBody(items: Array<{ dataIndex: number }>) {
                  const row = chartRows[items[0]?.dataIndex ?? 0];
                  if (!row) return "";
                  return `조회 → 완료: ${pct(row.signups, row.pageViews)}`;
                },
                label(context: { dataset: { label?: string }; parsed: { y: number | null } }) {
                  return `${context.dataset.label ?? ""}: ${fmtNumber(Number(context.parsed.y ?? 0))}`;
                },
                title(items: Array<{ dataIndex: number }>) {
                  return chartRows[items[0]?.dataIndex ?? 0]?.tooltipLabel ?? "";
                },
              },
              displayColors: true,
            },
          },
          responsive: true,
          scales: {
            x: { grid: { display: false }, ticks: { color: light } },
            y: { beginAtZero: true, border: { display: false }, grid: { color: soft }, ticks: { color: light } },
          },
        },
        type: "line",
      });
    }

    void renderChart();

    return () => {
      isDisposed = true;
      chart?.destroy();
    };
  }, [chartRows]);

  return (
    <Card
      actions={(
        <div className="btn-group">
          {funnelChartPeriods.map((item) => (
            <button
              aria-pressed={period === item.id}
              className={`btn ghost btn-sm ${period === item.id ? "is-active" : ""}`}
              key={item.id}
              onClick={() => setPeriod(item.id)}
              type="button"
            >
              {item.short}
            </button>
          ))}
        </div>
      )}
      eyebrow={`Conversion · ${periodLabel}`}
      title="전체 퍼널 추이"
    >
      {chartRows.length ? (
        <div className="chart-canvas-wrap">
          <canvas ref={canvasRef} aria-label={`조회수, 알림신청 클릭수, 알림신청 완료수 ${periodLabel} 추이`} />
        </div>
      ) : <EmptyState label="연결된 퍼널 timeline 데이터가 없습니다." />}
      <div className="chart-meta-row">
        <div className="chart-meta-cell"><span className="chart-meta-label">조회수</span><span className="chart-meta-value">{fmtNumber(stats.kpi.pageViews)}</span></div>
        <div className="chart-meta-cell"><span className="chart-meta-label">알림 클릭</span><span className="chart-meta-value up">{fmtNumber(stats.kpi.arrivals)}</span></div>
        <div className="chart-meta-cell"><span className="chart-meta-label">알림 완료</span><span className="chart-meta-value">{fmtNumber(stats.kpi.signups)}</span></div>
        <div className="chart-meta-cell"><span className="chart-meta-label">조회 → 완료</span><span className="chart-meta-value up">{stats.kpi.conversionRate.toFixed(1)}%</span></div>
      </div>
    </Card>
  );
}

function FunnelView({ onRefreshStats, stats, subTab }: { onRefreshStats: () => Promise<void>; stats: AdminStats; subTab: SubTabId }) {
  const [isEditingAdTests, setIsEditingAdTests] = useState(false);
  const [campaignDrafts, setCampaignDrafts] = useState<CampaignDrafts>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem("doripe-ops-campaign-drafts") ?? "{}") as CampaignDrafts;
    } catch {
      return {};
    }
  });
  const [hiddenCampaigns, setHiddenCampaigns] = useState<HiddenCampaigns>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("doripe-ops-hidden-campaigns") ?? "[]") as HiddenCampaigns;
    } catch {
      return [];
    }
  });
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);
  const [savingCampaignCode, setSavingCampaignCode] = useState<string | null>(null);

  const updateCampaignDraft = (code: string, draft: Partial<CampaignDrafts[string]>) => {
    setCampaignDrafts((current) => ({
      ...current,
      [code]: {
        ...current[code],
        ...draft,
      },
    }));
  };

  const resetCampaignDraft = (code: string) => {
    setCampaignDrafts((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
  };

  const hideCampaign = (code: string) => {
    if (!window.confirm("이 광고 테스트 항목을 화면에서 숨길까요? 실제 트래킹 데이터는 삭제되지 않습니다.")) return;
    setHiddenCampaigns((current) => Array.from(new Set([...current, code])));
  };

  const addCampaignTest = async () => {
    const label = window.prompt("광고 이름을 입력하세요.");
    const trimmedLabel = label?.trim();
    if (!trimmedLabel) return;

    setCampaignMessage(null);
    const response = await fetch(adminApiPath("/api/admin/campaigns"), {
      body: JSON.stringify({ label: trimmedLabel }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setCampaignMessage(payload?.message ?? "광고 테스트를 추가하지 못했습니다.");
      return;
    }

    await onRefreshStats();
    setCampaignMessage(`광고 링크가 생성되었습니다. ${payload?.campaign?.link ?? ""}`.trim());
  };

  const saveCampaignDraft = async (row: AdminStats["campaigns"][number]) => {
    const draft = campaignDrafts[row.code] ?? {};
    const label = (draft.label ?? row.label ?? row.code).trim();
    const parsedAdViews = Number.parseInt(String(draft.views ?? row.adViews ?? 0).replace(/,/g, ""), 10);
    const adViews = Number.isFinite(parsedAdViews) && parsedAdViews >= 0 ? parsedAdViews : 0;

    if (!label) {
      setCampaignMessage("광고 이름은 비워둘 수 없습니다.");
      return;
    }

    setSavingCampaignCode(row.code);
    setCampaignMessage(null);
    const response = await fetch(adminApiPath("/api/admin/campaigns"), {
      body: JSON.stringify({ adViews, code: row.code, label }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload = await response.json().catch(() => null);
    setSavingCampaignCode(null);

    if (!response.ok) {
      setCampaignMessage(payload?.message ?? "광고 테스트를 저장하지 못했습니다.");
      return;
    }

    resetCampaignDraft(row.code);
    await onRefreshStats();
    setCampaignMessage("광고 테스트를 저장했습니다.");
  };

  useEffect(() => {
    window.localStorage.setItem("doripe-ops-campaign-drafts", JSON.stringify(campaignDrafts));
  }, [campaignDrafts]);

  useEffect(() => {
    window.localStorage.setItem("doripe-ops-hidden-campaigns", JSON.stringify(hiddenCampaigns));
  }, [hiddenCampaigns]);

  if (subTab === "ad_tests") {
    const rows = stats.campaigns
      .filter((row) => (row.views || row.signups || row.notifyArrivals || row.adViews || row.label) && !hiddenCampaigns.includes(row.code))
      .map((row) => {
        const draft = campaignDrafts[row.code];
        const homepageViews = row.views;

        return {
          ...row,
          adViewsDisplay: draft?.views ?? String(row.adViews ?? 0),
          displayLabel: draft?.label?.trim() ? draft.label : (row.label || row.code),
          displayLink: row.link || `https://doripe.kr/?c=${encodeURIComponent(row.code)}`,
          homepageViews,
          signupRate: homepageViews ? row.signups / homepageViews : 0,
        };
      })
      .sort((a, b) => b.signupRate - a.signupRate || b.signups - a.signups || b.homepageViews - a.homepageViews || a.code.localeCompare(b.code));
    const actions = (
      <ActionButtons
        onAdd={() => void addCampaignTest()}
        editLabel={isEditingAdTests ? "완료" : "수정"}
        onEdit={() => setIsEditingAdTests((current) => !current)}
      />
    );

    return (
      <>
        <SectionIntro actions={actions} eyebrow="Funnel" title="광고 테스트" description="광고 조회수는 수기로 입력하고, 홈페이지 조회수와 알림신청 수는 생성된 링크의 실제 트래킹값으로 봅니다." />
        <Card actions={actions} eyebrow="Ads" title="광고 테스트">
          {campaignMessage ? <div className="inline-warning tag-manager-message">{campaignMessage}</div> : null}
          {rows.length ? (
            <DataTable
              headers={isEditingAdTests ? ["광고 이름", "광고 조회수", "홈페이지 조회수", "알림신청 수", "링크", "작업"] : ["광고 이름", "광고 조회수", "홈페이지 조회수", "알림신청 수", "링크"]}
              rows={rows.map((row) => [
                isEditingAdTests ? (
                  <input
                    className="inline-input"
                    onChange={(event) => updateCampaignDraft(row.code, { label: event.target.value })}
                    value={row.displayLabel}
                  />
                ) : row.displayLabel,
                isEditingAdTests ? (
                  <input
                    className="inline-input number"
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => updateCampaignDraft(row.code, { views: event.target.value })}
                    type="number"
                    value={row.adViewsDisplay}
                  />
                ) : fmtNumber(row.adViews),
                fmtNumber(row.homepageViews),
                `${fmtNumber(row.signups)} (${pct(row.signups, row.homepageViews)})`,
                isEditingAdTests ? (
                  <input
                    className="inline-input link"
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    value={row.displayLink}
                  />
                ) : <a href={row.displayLink} rel="noreferrer" target="_blank">{row.displayLink}</a>,
                ...(isEditingAdTests ? [
                  <div className="table-action-row">
                    <button className="link-button" disabled={savingCampaignCode === row.code} type="button" onClick={() => void saveCampaignDraft(row)}>
                      {savingCampaignCode === row.code ? "저장 중" : "저장"}
                    </button>
                    <button className="link-button" type="button" onClick={() => resetCampaignDraft(row.code)}>되돌리기</button>
                    <button className="link-button danger" type="button" onClick={() => hideCampaign(row.code)}>삭제</button>
                  </div>,
                ] : []),
              ])}
            />
          ) : <EmptyState label="캠페인별 실제 홈페이지 조회/신청 데이터가 없습니다." />}
        </Card>
      </>
    );
  }

  if (subTab === "share_links") {
    return (
      <>
        <SectionIntro eyebrow="Funnel" title="공유 링크 성과" description="장소 공유와 루트 공유를 분리해서 공유수, 클릭수, 클릭률을 봅니다." />
        <Card eyebrow="Share Link" title="공유 링크 성과">
          <EmptyState label="공유 링크 생성/클릭 이벤트 테이블이 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionIntro eyebrow="Funnel" title="전체 퍼널" description="조회수, 알림신청 클릭수, 알림신청 완료수를 한 화면에서 비교합니다." />
      <LineChartCard stats={stats} />
    </>
  );
}

function UsersView({ openDialog, stats, subTab }: { openDialog: OpenDialog; stats: AdminStats; subTab: SubTabId }) {
  if (subTab === "waitlist") {
    const waitlistTotal = stats.kpi.signups || stats.recentSignups.length;

    return (
      <>
        <SectionIntro eyebrow="Users" title="알림신청자" description="신청 시점에 받은 기본 정보만 봅니다. 설문 응답은 별도 탭에서 관리합니다." />
        <Card actions={<span className="status-pill count-pill">총 {fmtNumber(waitlistTotal)}명</span>} eyebrow="Waitlist" title="알림신청자">
          {stats.recentSignups.length ? (
            <DataTable
              headers={["이메일/휴대폰", "나이", "성별", "지역", "유입", "신청일"]}
              rows={stats.recentSignups.map((row) => [
                row.phone || row.email || "-",
                row.age,
                row.gender,
                row.region,
                row.campaignCode || "-",
                formatDate(row.date),
              ])}
            />
          ) : <EmptyState label="알림신청자 데이터가 없습니다." />}
        </Card>
      </>
    );
  }

  if (subTab === "waitlist_survey") return <WaitlistSurveyView openDialog={openDialog} stats={stats} />;

  if (subTab === "saved_places") {
    return (
      <>
        <SectionIntro
          actions={<div className="control-row"><button>필터</button><button>정렬</button></div>}
          eyebrow="Users"
          title="저장한 장소"
          description="Right Swipe와 Left Swipe를 나눠 장소카드 반응을 봅니다."
        />
        <Card eyebrow="Places" title="저장/패스 반응">
          <EmptyState label="앱 저장/패스 이벤트 데이터가 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  if (subTab === "created_routes") {
    return (
      <>
        <SectionIntro eyebrow="Users" title="만든 루트" description="유저가 직접 만든 루트와 구성 장소를 확인합니다." />
        <Card eyebrow="Routes" title="유저 생성 루트">
          <EmptyState label="유저 생성 루트 데이터가 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  if (subTab === "activity_logs") {
    return (
      <>
        <SectionIntro eyebrow="Users" title="행동 로그" description="카드 조회, 저장, 루트 생성, 공유 같은 주요 행동을 시간순으로 봅니다." />
        <Card eyebrow="Logs" title="행동 로그">
          <EmptyState label="앱 행동 로그 이벤트 데이터가 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  return (
    <>
      <SectionIntro eyebrow="Users" title="유저 목록" description="앱 이용자를 고유번호, 이름, 상태 중심으로 봅니다." />
      <Card eyebrow="Users" title="유저 목록">
        <EmptyState label="앱 유저 계정 테이블이 아직 연결되지 않았습니다." />
      </Card>
    </>
  );
}

function SurveyBarRow({ count, label, total }: { count: number; label: string; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="survey-bar-row">
      <strong>{label}</strong>
      <div className="survey-bar-track" aria-label={`${label} ${count}명 ${percent}%`}>
        <i style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span>{count}명 ({percent}%)</span>
    </div>
  );
}

function SurveyAnswerBlock({ title, value }: { title: string; value?: string | string[] }) {
  const values = Array.isArray(value) ? value : value ? [value] : ["응답 없음"];

  return (
    <article className="survey-answer-block">
      <strong>{title}</strong>
      <div>
        {values.map((item) => <span key={item}>{item}</span>)}
      </div>
    </article>
  );
}

function SurveyRespondentDetail({ respondent }: { respondent: SurveyRespondent }) {
  return (
    <div className="respondent-detail">
      <div className="respondent-basic-grid">
        <div><span>성별</span><strong>{respondent.gender}</strong></div>
        <div><span>나이</span><strong>{respondent.age}</strong></div>
        <div><span>연락처</span><strong>{respondent.contact}</strong></div>
        <div><span>주 활동 지역</span><strong>{respondent.region}</strong></div>
        <div><span>캠페인</span><strong>{respondent.campaignCode}</strong></div>
        <div><span>ID</span><strong>{respondent.id}</strong></div>
      </div>
      <div className="survey-answer-grid">
        <SurveyAnswerBlock title="Q2 가장 공감되는 불편" value={respondent.painPoint} />
        <SurveyAnswerBlock title="Q3 먼저 써보고 싶은 기능" value={respondent.desiredFeatures} />
        <SurveyAnswerBlock title="Q4 최근 갈 곳을 정한 방식" value={respondent.recentSearchMethods} />
        <SurveyAnswerBlock title="Q5 마음에 든 장소 저장 위치" value={respondent.saveLocations} />
        <SurveyAnswerBlock title="Q6 베타에서 먼저 받고 싶은 결과물" value={respondent.betaResult} />
        <SurveyAnswerBlock title="Q7 베타 참여 의향" value={respondent.betaCommitment} />
        <SurveyAnswerBlock title="Q8 자유응답" value={respondent.opinion} />
      </div>
    </div>
  );
}

function WaitlistSurveyView({ openDialog, stats }: { openDialog: OpenDialog; stats: AdminStats }) {
  const surveyQuestions = useMemo(() => buildSurveyQuestions(stats), [stats]);
  const surveyRespondents = useMemo(() => buildSurveyRespondents(stats.recentSignups), [stats.recentSignups]);
  const surveyTotalResponses = stats.kpi.signups || stats.recentSignups.length;
  const [selectedQuestionId, setSelectedQuestionId] = useState(surveyQuestions[0].id);
  const selectedQuestionIndex = Math.max(0, surveyQuestions.findIndex((question) => question.id === selectedQuestionId));
  const selectedQuestion = surveyQuestions[selectedQuestionIndex] ?? surveyQuestions[0];
  const isFirstQuestion = selectedQuestionIndex === 0;
  const isLastQuestion = selectedQuestionIndex === surveyQuestions.length - 1;

  const moveQuestion = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(selectedQuestionIndex + direction, 0), surveyQuestions.length - 1);
    setSelectedQuestionId(surveyQuestions[nextIndex].id);
  };

  return (
    <>
      <SectionIntro eyebrow="Users" title="알림신청 설문" description="실제 알림신청에서 물어본 질문 기준으로 응답 분포와 응답자별 상세 답변을 봅니다." />
      <div className="stack">
        <Card eyebrow="Survey" title="질문별 응답 분포">
          <div className="survey-question-pager">
            <button
              className="survey-pager-button"
              disabled={isFirstQuestion}
              type="button"
              onClick={() => moveQuestion(-1)}
            >
              이전
            </button>
            <div className="survey-current-question">
              <span>{selectedQuestionIndex + 1} / {surveyQuestions.length}</span>
              <strong>{selectedQuestion.label} · {selectedQuestion.title}</strong>
            </div>
            <button
              className="survey-pager-button"
              disabled={isLastQuestion}
              type="button"
              onClick={() => moveQuestion(1)}
            >
              다음
            </button>
          </div>
          <div className="survey-summary-head">
            <div>
              <span>{selectedQuestion.label}</span>
              <strong>{selectedQuestion.title}</strong>
              <p>{selectedQuestion.description}</p>
            </div>
            <em>
              {selectedQuestion.quotes ? `자유응답 · ${selectedQuestion.quotes.length}개` : `${selectedQuestion.multi ? "복수 선택" : "단일 선택"} · 기준 ${surveyTotalResponses}명`}
            </em>
          </div>
          {selectedQuestion.quotes ? (
            <div className="survey-quote-list">
              {selectedQuestion.quotes.length ? selectedQuestion.quotes.map((quote, index) => (
                <article className="survey-quote-card" key={quote}>
                  <span>응답 {index + 1}</span>
                  <p>"{quote}"</p>
                </article>
              )) : <EmptyState label="자유응답 데이터가 없습니다." />}
            </div>
          ) : (
            <div className="survey-bar-list">
              {selectedQuestion.options.length ? selectedQuestion.options.map((option) => (
                <SurveyBarRow count={option.count} key={option.label} label={option.label} total={surveyTotalResponses} />
              )) : <EmptyState label="이 질문의 응답 데이터가 없습니다." />}
            </div>
          )}
        </Card>
        <Card eyebrow="Respondents" title="응답자 전체 리스트">
          {surveyRespondents.length ? (
            <DataTable
              headers={["성별", "나이", "연락처", "자세히보기"]}
              rows={surveyRespondents.map((respondent) => [
                respondent.gender,
                respondent.age,
                respondent.contact,
                <button
                  className="link-button"
                  type="button"
                  onClick={() => openDialog({
                    body: <SurveyRespondentDetail respondent={respondent} />,
                    confirmLabel: "확인",
                    description: `${respondent.gender} · ${respondent.age} · ${respondent.contact}`,
                    title: `${respondent.name} 설문 상세`,
                  })}
                >
                  자세히보기
                </button>,
              ])}
            />
          ) : <EmptyState label="응답자 데이터가 없습니다." />}
        </Card>
      </div>
    </>
  );
}

function CreatorPhotoLibrary({ data, submissions }: { data: OpsData; submissions: CreatorSubmission[] }) {
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [placeQuery, setPlaceQuery] = useState("");
  const [providerQuery, setProviderQuery] = useState("");
  const [selectedProviderKey, setSelectedProviderKey] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"latest" | "name" | "photoCount">("latest");

  const providers = useMemo(
    () => [
      buildDoripePhotoProvider(data),
      buildNaverPhotoProvider(data),
      ...buildCreatorPhotoProviders(submissions).filter((provider) => provider.photoCount > 0),
    ].filter((provider) => provider.providerType === "Doripe" || provider.providerType === "Naver" || provider.photoCount > 0),
    [data, submissions],
  );

  const visibleProviders = useMemo(() => {
    const query = providerQuery.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((provider) => (
      provider.name.toLowerCase().includes(query)
      || provider.handle.toLowerCase().includes(query)
    ));
  }, [providerQuery, providers]);

  const activeProvider = visibleProviders.find((provider) => provider.key === selectedProviderKey)
    ?? visibleProviders[0]
    ?? providers[0]
    ?? null;

  const categoryOptions = useMemo(() => {
    if (!activeProvider) return ["전체"];
    const categories = (activeProvider.placeGroups ?? buildCreatorPlacePhotoGroups(activeProvider.submissions))
      .map((place) => place.category ?? "유형 미정")
      .filter(Boolean);
    return ["전체", ...Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b, "ko"))];
  }, [activeProvider]);

  useEffect(() => {
    if (!categoryOptions.includes(categoryFilter)) setCategoryFilter("전체");
  }, [categoryFilter, categoryOptions]);

  const placeGroups = useMemo(() => {
    if (!activeProvider) return [];

    const query = placeQuery.trim().toLowerCase();
    return (activeProvider.placeGroups ?? buildCreatorPlacePhotoGroups(activeProvider.submissions))
      .filter((place) => categoryFilter === "전체" || place.category === categoryFilter)
      .filter((place) => !query || place.name.toLowerCase().includes(query) || place.category.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortMode === "photoCount") return b.photos.length - a.photos.length || a.name.localeCompare(b.name, "ko");
        if (sortMode === "name") return a.name.localeCompare(b.name, "ko");
        return b.latestAt.localeCompare(a.latestAt) || b.photos.length - a.photos.length;
      });
  }, [activeProvider, categoryFilter, placeQuery, sortMode]);

  const visiblePhotoCount = placeGroups.reduce((sum, place) => sum + place.photos.length, 0);

  return (
    <Card eyebrow="Photo Library" title="제공자별 제공 사진">
      <div className="creator-photo-layout">
        <aside className="provider-list-panel">
          <div className="provider-search-wrap">
            <span>제공자</span>
            <input
              className="library-search"
              onChange={(event) => setProviderQuery(event.target.value)}
              placeholder="이름, 인스타, 이메일 검색"
              value={providerQuery}
            />
          </div>
          <div className="provider-list-scroll">
            {visibleProviders.length ? visibleProviders.map((provider) => (
              <button
                className={`provider-list-item ${activeProvider?.key === provider.key ? "is-selected" : ""}`}
                key={provider.key}
                type="button"
                onClick={() => setSelectedProviderKey(provider.key)}
              >
                <span className="provider-avatar">{provider.name.slice(0, 1)}</span>
                <span className="provider-copy">
                  <strong>{provider.name}</strong>
                  <em>{provider.handle}</em>
                </span>
                <small>{provider.photoCount}장</small>
              </button>
            )) : <EmptyState label="검색된 제공자가 없습니다." />}
          </div>
        </aside>

        <section className="provider-photo-panel">
          {activeProvider ? (
            <>
              <div className="provider-photo-head">
                <div>
                  <span>선택 제공자</span>
                  <h3>{activeProvider.name}</h3>
                  <p>{activeProvider.handle}</p>
                </div>
                <div className="provider-photo-stats">
                  <strong>{activeProvider.placeCount}곳</strong>
                  <strong>{activeProvider.photoCount}장</strong>
                  <strong>{visiblePhotoCount}장 표시</strong>
                </div>
              </div>

              <div className="library-toolbar creator-photo-toolbar">
                <input
                  className="library-search"
                  onChange={(event) => setPlaceQuery(event.target.value)}
                  placeholder="장소명, 유형 검색"
                  value={placeQuery}
                />
                <select className="status-select" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                  {categoryOptions.map((category) => <option key={category}>{category}</option>)}
                </select>
                <select className="status-select" onChange={(event) => setSortMode(event.target.value as "latest" | "name" | "photoCount")} value={sortMode}>
                  <option value="latest">최근순</option>
                  <option value="photoCount">사진 많은순</option>
                  <option value="name">장소명순</option>
                </select>
              </div>

              <div className="provider-place-scroll">
                {placeGroups.length ? placeGroups.map((place) => (
                  <section className="provider-place-section" key={`${place.name}-${place.category}-${place.submissionIds.join("-")}`}>
                    <div className="provider-place-head">
                      <div>
                        <h4>{place.name}</h4>
                        <p>{place.category} · {place.status} · {formatDate(place.latestAt)}</p>
                      </div>
                      <span>{place.photos.length}장</span>
                    </div>
                    <div className="provider-photo-grid">
                      {place.photos.map((photo, index) => (
                        <button
                          aria-label={`${place.name} 사진 ${index + 1}`}
                          className="photo-tile provider-photo-tile"
                          key={photo.id ?? `${photo.signed_url}-${index}`}
                          style={{ backgroundImage: `url(${photo.signed_url})` }}
                          type="button"
                        >
                          <span>{index + 1}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )) : <EmptyState label="조건에 맞는 장소 사진이 없습니다." />}
              </div>
            </>
          ) : <EmptyState label="사진이 연결된 제공자 데이터가 없습니다." />}
        </section>
      </div>
    </Card>
  );
}

function CreatorsView({
  data,
  openDialog,
  submissions,
  subTab,
}: {
  data: OpsData;
  openDialog: OpenDialog;
  submissions: CreatorSubmission[];
  subTab: SubTabId;
}) {
  const systemProviders = [buildDoripePhotoProvider(data), buildNaverPhotoProvider(data)];
  const providerRows = [
    ...systemProviders.map((provider) => [
      provider.name,
      provider.providerType,
      provider.providerType === "Doripe" && provider.placeCount === 0 ? "관리자용" : `${provider.placeCount}곳`,
      `${provider.photoCount}장`,
    ]),
    ...buildCreatorPhotoProviders(submissions).slice(0, 50).map((provider) => [
      provider.name,
      provider.providerType,
      provider.placeCount ? `${provider.placeCount}곳` : "장소 미정",
      `${provider.photoCount}장`,
    ]),
  ];

  if (subTab === "creator_photos") {
    return (
      <>
        <SectionIntro eyebrow="Creators" title="제공 사진" description="제공자를 선택하고, 오른쪽에서 장소별 제공 사진을 필터/정렬해서 확인합니다." />
        <CreatorPhotoLibrary data={data} submissions={submissions} />
      </>
    );
  }

  if (subTab === "creator_contacts") {
    const actions = (
      <ActionButtons
        onAdd={() => openDialog({ body: <FormPreview fields={["제공자 이름", "채널", "상태"]} />, title: "컨택 추가" })}
      />
    );
    return (
      <>
        <SectionIntro actions={actions} eyebrow="Creators" title="컨택 상태" description="사진 제공 가능성이 있는 계정의 연락 상태를 관리합니다." />
        <Card actions={actions} eyebrow="Contact" title="컨택 상태">
          <EmptyState label="사진제공자 컨택 상태 테이블이 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  const actions = (
    <ActionButtons
      onAdd={() => openDialog({ body: <ProviderFormPreview mode="add" />, title: "사진제공자 추가" })}
    />
  );

  return (
    <>
      <SectionIntro actions={actions} eyebrow="Creators" title="제공자 목록" description="Doripe, Naver, 가게, 큐레이터 유형별 사진 제공자를 관리합니다." />
      <Card actions={actions} eyebrow="Creators" title="사진제공자 관리">
        <DataTable headers={["제공자 이름", "유형", "장소", "사진 개수"]} rows={providerRows} />
      </Card>
    </>
  );
}

function StoresView({ data, openDialog, subTab }: { data: OpsData; openDialog: OpenDialog; subTab: SubTabId }) {
  const placeRows = data.places.slice(0, 50).map((place) => [
    place.name ?? "이름 없는 장소",
    formatCategory(place.category_id, data.categories),
    formatNeighborhood(place.neighborhood_id, data.neighborhoods),
    "",
    "",
    "",
  ]);

  if (subTab === "store_contacts") {
    const actions = (
      <ActionButtons
        onAdd={() => openDialog({ body: <FormPreview fields={["장소 이름", "동네", "유형", "컨택처"]} />, title: "가게 컨택 추가" })}
      />
    );
    return (
      <>
        <SectionIntro actions={actions} eyebrow="Stores" title="가게 컨택" description="장소별 연락 채널과 컨택 상태를 관리합니다." />
        <Card actions={actions} eyebrow="Contact" title="가게 컨택">
          <EmptyState label="가게 컨택 상태 테이블이 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  if (subTab === "partnership_status") {
    const actions = (
      <ActionButtons
        onAdd={() => openDialog({ body: <FormPreview fields={["장소 이름", "내용", "자세한 내용"]} />, title: "제휴/제외 추가" })}
      />
    );
    return (
      <>
        <SectionIntro actions={actions} eyebrow="Stores" title="제휴/제외 상태" description="제휴 가능성, 제외 사유, 상세 메모를 관리합니다." />
        <Card actions={actions} eyebrow="Status" title="제휴/제외 상태">
          <EmptyState label="제휴/제외 상태 테이블이 아직 연결되지 않았습니다." />
        </Card>
      </>
    );
  }

  const actions = (
    <ActionButtons
      onAdd={() => openDialog({ body: <FormPreview fields={["가게 이름", "유형", "동네", "전화번호", "이메일", "인스타그램 아이디"]} />, title: "가게 추가" })}
    />
  );

  return (
    <>
      <SectionIntro actions={actions} eyebrow="Stores" title="가게 목록" description="가게 기본 정보와 비어 있을 수 있는 연락처를 함께 관리합니다." />
      <Card actions={actions} eyebrow="Stores" title="가게 목록">
        {placeRows.length ? <DataTable headers={["가게 이름", "유형", "동네", "전화번호", "이메일", "인스타그램 아이디"]} rows={placeRows} /> : <EmptyState label="장소 데이터가 없습니다." />}
      </Card>
    </>
  );
}

function MediaLibrary({
  closeDialog,
  data,
  mode,
  onDataChange,
  onRefreshData,
  openDialog,
  providerOptions = [],
}: {
  closeDialog?: () => void;
  data: OpsData;
  mode: "manage" | "provider" | "review";
  onDataChange?: OpsDataUpdater;
  onRefreshData?: () => Promise<void>;
  openDialog?: OpenDialog;
  providerOptions?: PhotoProviderOption[];
}) {
  const isReview = mode === "review";
  const isManage = mode === "manage";
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [activeNeighborhoodId, setActiveNeighborhoodId] = useState("all");
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => makePlaceDraft(data.places[0], data));
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isProviderPickerOpen, setIsProviderPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [providerQuery, setProviderQuery] = useState("");
  const [isPhotoSelectMode, setIsPhotoSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoCropDrafts, setPhotoCropDrafts] = useState<Record<string, PhotoCrop>>({});
  const [photoCropSaveState, setPhotoCropSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoCropSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoCropDragRef = useRef<{
    crop: PhotoCrop;
    height: number;
    key: string;
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
  } | null>(null);
  const lastSavedDraftSignatureRef = useRef("");

  const filteredPlaces = useMemo(() => {
    const query = placeQuery.trim().toLowerCase();
    return data.places.filter((place) => {
      const matchesNeighborhood = activeNeighborhoodId === "all" || place.neighborhood_id === activeNeighborhoodId;
      const placeCategoryId = normalizePlaceCategoryId(place.category_id, data.categories);
      const matchesCategory = activeCategoryId === "all" || placeCategoryId === activeCategoryId;
      const matchesQuery = !query
        || (place.name ?? "").toLowerCase().includes(query)
        || (place.short_copy ?? "").toLowerCase().includes(query)
        || (place.editorial_note ?? "").toLowerCase().includes(query)
        || [...(place.mood_tags ?? []), ...(place.best_for ?? []), ...(place.time_tags ?? [])].some((tag) => tag.toLowerCase().includes(query));

      return matchesNeighborhood && matchesCategory && matchesQuery;
    });
  }, [activeCategoryId, activeNeighborhoodId, data.categories, data.places, placeQuery]);

  const activePlace = filteredPlaces.find((place) => place.id === activePlaceId) ?? filteredPlaces[0];
  const activePhotos = getAppPhotos(activePlace);
  const activeNeighborhood = activePlace ? formatNeighborhood(activePlace.neighborhood_id, data.neighborhoods) : "-";
  const activeCategory = activePlace ? formatCategory(activePlace.category_id, data.categories) : "-";
  const activeTags = activePlace ? [...(activePlace.mood_tags ?? []), ...(activePlace.best_for ?? [])] : [];
  const publishedPhotos = getPublishedPhotos(activePhotos);
  const publishedPhotoSlotByKey = getPublishedPhotoSlotMap(activePhotos);
  const categoryOptions = categoryOptionsWithFallback(data.categories);
  const editableCategoryOptions = categoryOptionsWithFallback(data.categories);
  const coverPhoto = getCoverPhoto(activePlace, publishedPhotos);
  const moodOptions = getManagedTags(data, "mood", "mood_tags");
  const situationOptions = getManagedTags(data, "situation", "best_for");
  const selectedPhoto = activePhotos[selectedPhotoIndex] ?? activePhotos[0];
  const selectedPhotoKey = getPhotoKey(selectedPhoto);
  const selectedPhotoCrop = normalizePhotoCrop(selectedPhoto, selectedPhotoKey ? photoCropDrafts[selectedPhotoKey] : undefined);
  const selectedPhotoSlot = publishedPhotoSlotByKey.get(getPhotoKey(selectedPhoto));
  const selectedProvider = selectedPhoto
    ? providerOptions.find((provider) => provider.label === selectedPhoto.rights_holder_name)
      ?? providerOptions.find((provider) => provider.sourceType === selectedPhoto.source_type)
    : null;
  const visibleProviderOptions = providerOptions.filter((provider) => {
    const query = providerQuery.trim().toLowerCase();
    if (!query) return true;
    return provider.label.toLowerCase().includes(query) || provider.meta.toLowerCase().includes(query);
  });

  function replacePlaceLocally(place: PlaceRow | null | undefined) {
    if (!place?.id || !onDataChange) return;
    onDataChange((current) => ({
      ...current,
      places: current.places.map((item) => item.id === place.id ? { ...item, ...place } : item),
    }));
  }

  function patchPlaceLocally(placeId: string, patch: Partial<PlaceRow>) {
    if (!onDataChange) return;
    onDataChange((current) => ({
      ...current,
      places: current.places.map((item) => item.id === placeId ? { ...item, ...patch } : item),
    }));
  }

  function patchPhotoLocally(photo: PlacePhotoRow | null | undefined) {
    if (!photo?.id || !onDataChange) return;
    onDataChange((current) => ({
      ...current,
      places: current.places.map((place) => {
        const photos = place.place_photos ?? [];
        if (!photos.some((item) => item.id === photo.id)) return place;
        return {
          ...place,
          place_photos: photos.map((item) => item.id === photo.id ? { ...item, ...photo } : item),
        };
      }),
    }));
  }

  function removePlaceLocally(placeId: string) {
    if (!onDataChange) return;
    onDataChange((current) => ({
      ...current,
      places: current.places.filter((place) => place.id !== placeId),
    }));
  }

  useEffect(() => {
    const nextDraft = makePlaceDraft(activePlace, data);
    setDraft(nextDraft);
    lastSavedDraftSignatureRef.current = placeDraftSignature(nextDraft);
    setIsAddressSearchOpen(false);
    setIsEditing(false);
    setIsProviderPickerOpen(false);
    setLocalMessage(null);
    setProviderQuery("");
    setIsPhotoSelectMode(false);
    setSelectedPhotoIds([]);
    setSelectedPhotoIndex(0);
    setPhotoCropSaveState("idle");
  }, [activePlace?.id]);

  useEffect(() => () => {
    if (photoCropSaveTimerRef.current) {
      clearTimeout(photoCropSaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setPhotoCropSaveState("idle");
    photoCropDragRef.current = null;
  }, [selectedPhotoKey]);

  useEffect(() => {
    if (!isReview || !activePlace) return;
    const signature = placeDraftSignature(draft);
    if (signature === lastSavedDraftSignatureRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void savePlaceCard({ auto: true, signature });
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [activePlace?.id, draft, isReview]);

  function updateDraft(field: keyof ReturnType<typeof makePlaceDraft>, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function patchPhotoCropDraft(photo: PlacePhotoRow | undefined, crop: PhotoCrop) {
    const key = getPhotoKey(photo);
    if (!key) return;
    setPhotoCropDrafts((current) => ({ ...current, [key]: crop }));
  }

  async function savePhotoCrop(photo: PlacePhotoRow, crop: PhotoCrop) {
    if (!photo.id) {
      setPhotoCropSaveState("error");
      setLocalMessage("DB 사진 ID가 있는 사진만 배치를 저장할 수 있습니다.");
      return;
    }

    setPhotoCropSaveState("saving");
    try {
      const response = await fetch(adminApiPath("/api/admin/photos"), {
        body: JSON.stringify({
          crop_x: crop.x,
          crop_y: crop.y,
          crop_zoom: crop.zoom,
          id: photo.id,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setPhotoCropSaveState("error");
        setLocalMessage(body?.message ?? "사진 배치 저장에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null) as { photo?: PlacePhotoRow } | null;
      patchPhotoLocally(body?.photo ?? {
        ...photo,
        crop_x: crop.x,
        crop_y: crop.y,
        crop_zoom: crop.zoom,
      });
      setPhotoCropSaveState("saved");
    } catch (error) {
      setPhotoCropSaveState("error");
      setLocalMessage(error instanceof Error ? error.message : "사진 배치 저장에 실패했습니다.");
    }
  }

  function schedulePhotoCropSave(photo: PlacePhotoRow | undefined, crop: PhotoCrop) {
    if (!photo?.id) return;
    if (photoCropSaveTimerRef.current) {
      clearTimeout(photoCropSaveTimerRef.current);
    }
    setPhotoCropSaveState("saving");
    photoCropSaveTimerRef.current = setTimeout(() => {
      void savePhotoCrop(photo, crop);
    }, 520);
  }

  function updateSelectedPhotoCrop(nextCrop: PhotoCrop) {
    if (!selectedPhoto) return;
    const crop = {
      x: clampNumber(nextCrop.x, 0, 100),
      y: clampNumber(nextCrop.y, 0, 100),
      zoom: clampNumber(nextCrop.zoom, 1, 3),
    };
    patchPhotoCropDraft(selectedPhoto, crop);
    schedulePhotoCropSave(selectedPhoto, crop);
  }

  function startPhotoCropDrag(event: PointerEvent<HTMLDivElement>) {
    if (!selectedPhoto || !selectedPhotoKey) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    photoCropDragRef.current = {
      crop: selectedPhotoCrop,
      height: bounds.height || 1,
      key: selectedPhotoKey,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width || 1,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function movePhotoCropDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = photoCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.key !== selectedPhotoKey) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    updateSelectedPhotoCrop({
      x: drag.crop.x - (dx / drag.width) * 100,
      y: drag.crop.y - (dy / drag.height) * 100,
      zoom: drag.crop.zoom,
    });
    event.preventDefault();
  }

  function endPhotoCropDrag(event: PointerEvent<HTMLDivElement>) {
    if (photoCropDragRef.current?.pointerId === event.pointerId) {
      photoCropDragRef.current = null;
    }
  }

  function zoomPhotoCrop(event: WheelEvent<HTMLDivElement>) {
    if (!selectedPhoto) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    updateSelectedPhotoCrop({
      ...selectedPhotoCrop,
      zoom: selectedPhotoCrop.zoom + delta,
    });
  }

  function resetSelectedPhotoCrop() {
    updateSelectedPhotoCrop({ x: 50, y: 50, zoom: 1 });
  }

  const selectAddress = useCallback((address: string, result: KakaoPostcodeData) => {
    setDraft((current) => ({ ...current, address }));
    setIsAddressSearchOpen(false);
    setLocalMessage(`${result.zonecode ? `${result.zonecode} · ` : ""}${address} 주소를 입력했습니다.`);
  }, []);

  async function saveSelectedPhotoProvider(provider: PhotoProviderOption) {
    if (!selectedPhoto?.id) {
      setLocalMessage("선택한 사진은 DB 사진 ID가 없어 제공자를 지정할 수 없습니다.");
      return;
    }

    setIsSaving(true);
    setLocalMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/photos"), {
        body: JSON.stringify({
          credit_text: provider.meta,
          id: selectedPhoto.id,
          rights_holder_name: provider.label,
          source_type: provider.sourceType,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "사진제공자 저장에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null) as { photo?: PlacePhotoRow } | null;
      patchPhotoLocally(body?.photo ?? {
        ...selectedPhoto,
        credit_text: provider.meta,
        rights_holder_name: provider.label,
        source_type: provider.sourceType,
      });
      setIsProviderPickerOpen(false);
      setLocalMessage(`${provider.label} 제공자로 저장했습니다.`);
    } finally {
      setIsSaving(false);
    }
  }

  function openDirectPlaceCreateDialog() {
    if (!openDialog || !closeDialog || !onRefreshData) return;
    openDialog({
      body: <PlaceCreateForm data={data} onCancel={closeDialog} onCreated={onRefreshData} />,
      description: "장소 유형은 단일 선택, 분위기와 상황은 복수 선택입니다.",
      hideActions: true,
      title: "장소카드 추가",
    });
  }

  function openNaverPlaceImportDialog() {
    if (!openDialog || !closeDialog || !onRefreshData) return;
    openDialog({
      body: <NaverPlaceImportForm data={data} onCancel={closeDialog} onCreated={onRefreshData} />,
      description: "네이버지도 링크를 넣으면 장소 정보와 사진을 가져와 장소카드를 생성합니다.",
      hideActions: true,
      title: "네이버지도 추가하기",
    });
  }

  function openPlaceAddMethodDialog() {
    if (!openDialog) return;
    openDialog({
      body: <PlaceAddMethodPicker onDirectAdd={openDirectPlaceCreateDialog} onNaverAdd={openNaverPlaceImportDialog} />,
      description: "네이버지도 링크 기반 추가와 직접 입력 방식 중 하나를 선택합니다.",
      hideActions: true,
      title: "장소 추가 방식 선택",
    });
  }

  function openPhotoProviderDialog(photo: PlacePhotoRow) {
    if (!openDialog || !closeDialog || !onRefreshData) return;
    if (!photo.id) {
      setLocalMessage("이 사진은 DB 사진 ID가 없어 제공자를 지정할 수 없습니다.");
      return;
    }
    openDialog({
      body: (
        <PhotoProviderEditor
          onCancel={closeDialog}
          onSaved={onRefreshData}
          photo={photo}
          providerOptions={providerOptions}
        />
      ),
      description: "사진제공자 목록에서 이 사진의 제공자를 지정합니다.",
      hideActions: true,
      title: "사진 제공자 관리",
    });
  }

  async function buildPlaceCardPayload(nextCoverPhoto: PlacePhotoRow | undefined = coverPhoto) {
    if (!activePlace) return null;

    const publishedCoverPhoto = nextCoverPhoto && isPublishedPhoto(nextCoverPhoto)
      ? nextCoverPhoto
      : getCoverPhoto(activePlace, publishedPhotos);
    const imageUrls = orderedImageUrlsForCover(publishedPhotos, publishedCoverPhoto).slice(0, 5);
    const categoryId = draft.category_id === UNCATEGORIZED_CATEGORY_ID
      ? await ensureUncategorizedCategory(data)
      : draft.category_id;

    return {
      address: draft.address,
      best_for: csvToList(draft.best_for),
      category_id: categoryId,
      cover_image_url: publishedCoverPhoto?.public_url ?? imageUrls[0] ?? "",
      cover_photo_id: publishedCoverPhoto?.id ?? null,
      editorial_note: draft.editorial_note,
      hours_text: draft.hours_text,
      id: activePlace.id,
      image_credit: activePlace.image_credit ?? "team",
      image_urls: imageUrls,
      instagram_url: draft.instagram_url,
      last_checked_at: activePlace.last_checked_at ?? null,
      lat: activePlace.lat ?? 0,
      lng: activePlace.lng ?? 0,
      mood_tags: csvToList(draft.mood_tags),
      name: draft.name,
      naver_place_url: draft.naver_place_url,
      nearest_station: activePlace.nearest_station ?? "",
      neighborhood_id: draft.neighborhood_id,
      photo_qa_status: activePlace.photo_qa_status ?? "pending",
      phone_text: draft.phone_text,
      price_hint: draft.price_hint,
      qa_status: activePlace.qa_status ?? "draft",
      representative_menu_name: draft.representative_menu_name,
      representative_menu_price: draft.representative_menu_price,
      route_role: activePlace.route_role ?? "middle",
      short_copy: draft.short_copy,
      status: draft.status === "ready" ? "ready" : "draft",
      stay_time_minutes: activePlace.stay_time_minutes ?? 45,
      sub_area: draft.sub_area,
      time_tags: activePlace.time_tags ?? [],
    };
  }

  async function savePlaceCard(options: { auto?: boolean; signature?: string } = {}) {
    if (!activePlace) return;
    setIsSaving(true);
    if (!options.auto) setLocalMessage(null);

    try {
      const payload = await buildPlaceCardPayload();
      if (!payload) return;
      const response = await fetch(adminApiPath("/api/admin/places"), {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "장소카드 저장에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null);
      lastSavedDraftSignatureRef.current = options.signature ?? placeDraftSignature(draft);
      replacePlaceLocally(body?.place ?? payload);
      if (body?.migrationRequired) {
        setLocalMessage(body.message ?? "DB 마이그레이션 전이라 일부 세부 필드는 아직 저장되지 않았습니다.");
      } else if (!options.auto) {
        setIsEditing(false);
        setLocalMessage("장소카드를 저장했습니다.");
      } else {
        setLocalMessage("자동 저장됨");
      }
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "장소카드 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function savePlaceStatus(nextStatus: "draft" | "ready") {
    if (!activePlace) return;

    setIsSaving(true);
    setLocalMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/places"), {
        body: JSON.stringify({ id: activePlace.id, status: nextStatus }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "장소 노출 상태 저장에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null) as { place?: PlaceRow } | null;
      setDraft((current) => ({ ...current, status: nextStatus }));
      replacePlaceLocally(body?.place ?? { ...activePlace, status: nextStatus });
      setLocalMessage(`앱 노출 상태를 ${placeStatusLabel(nextStatus)}로 바꿨습니다.`);
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "장소 노출 상태 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCoverPhoto(photo: PlacePhotoRow | undefined) {
    if (!activePlace || !photo?.public_url) {
      setLocalMessage("대표사진으로 설정할 사진이 없습니다.");
      return;
    }

    if (!photo.id) {
      setLocalMessage("DB 사진 ID가 있는 사진만 대표사진으로 설정할 수 있습니다.");
      return;
    }

    setIsSaving(true);
    setLocalMessage(null);

    try {
      const currentPublishedPhotoIds = publishedPhotos
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));
      const photoIds = [
        photo.id,
        ...currentPublishedPhotoIds.filter((id) => id !== photo.id),
      ].slice(0, 5);

      const response = await fetch(adminApiPath("/api/admin/photos/activate"), {
        body: JSON.stringify({
          photo_ids: photoIds,
          place_id: activePlace.id,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "대표사진 저장에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null) as { place?: PlaceRow } | null;
      replacePlaceLocally(body?.place);
      setLocalMessage("대표사진을 게시 1번으로 설정했습니다.");
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "대표사진 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePhoto(photo: PlacePhotoRow) {
    if (!photo.id) {
      setLocalMessage("이 사진은 DB 사진 ID가 없어 여기서 삭제할 수 없습니다.");
      return;
    }

    setIsSaving(true);
    setLocalMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/photos"), {
        body: JSON.stringify({ id: photo.id }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "사진 삭제에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null) as { place?: PlaceRow } | null;
      replacePlaceLocally(body?.place);
      setSelectedPhotoIds((current) => current.filter((id) => id !== photo.id));
      setSelectedPhotoIndex((current) => Math.max(0, Math.min(current, activePhotos.length - 2)));
      setLocalMessage("사진을 삭제했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function togglePhotoSelection(photo: PlacePhotoRow) {
    if (!photo.id) {
      setLocalMessage("DB 사진 ID가 있는 사진만 선택할 수 있습니다.");
      return;
    }

    setSelectedPhotoIds((current) => {
      if (current.includes(photo.id as string)) {
        return current.filter((id) => id !== photo.id);
      }

      if (current.length >= 5) {
        setLocalMessage("앱에 활성화할 사진은 최대 5장까지 선택할 수 있습니다.");
        return current;
      }

      return [...current, photo.id as string];
    });
  }

  async function deleteSelectedPhotos() {
    if (!selectedPhotoIds.length) return;
    if (!window.confirm(`선택한 사진 ${selectedPhotoIds.length}장을 삭제할까요?`)) return;

    setIsSaving(true);
    setLocalMessage(null);
    try {
      let nextPlace: PlaceRow | null = null;
      for (const id of selectedPhotoIds) {
        const response = await fetch(adminApiPath("/api/admin/photos"), {
          body: JSON.stringify({ id }),
          headers: { "content-type": "application/json" },
          method: "DELETE",
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setLocalMessage(body?.message ?? "선택 사진 삭제에 실패했습니다.");
          return;
        }

        const body = await response.json().catch(() => null) as { place?: PlaceRow } | null;
        if (body?.place) nextPlace = body.place;
      }

      replacePlaceLocally(nextPlace);
      setSelectedPhotoIds([]);
      setIsPhotoSelectMode(false);
      setLocalMessage("선택한 사진을 삭제했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function activateSelectedPhotos() {
    if (!activePlace) {
      setLocalMessage("실제 장소카드 사진만 활성화할 수 있습니다.");
      return;
    }

    if (!selectedPhotoIds.length) {
      setLocalMessage("활성화할 사진을 선택해 주세요.");
      return;
    }

    if (selectedPhotoIds.length > 5) {
      setLocalMessage("앱에 활성화할 사진은 최대 5장입니다.");
      return;
    }

    setIsSaving(true);
    setLocalMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/photos/activate"), {
        body: JSON.stringify({
          photo_ids: selectedPhotoIds,
          place_id: activePlace.id,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "선택 사진 활성화에 실패했습니다.");
        return;
      }

      const body = await response.json().catch(() => null) as { place?: PlaceRow } | null;
      replacePlaceLocally(body?.place);
      setSelectedPhotoIds([]);
      setIsPhotoSelectMode(false);
      setIsEditing(false);
      setLocalMessage("선택한 사진을 활성화하고 장소카드를 게시 상태로 바꿨습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePlaceCard() {
    if (!activePlace) return;

    if (!window.confirm(`${activePlace.name ?? activePlace.id} 장소카드를 삭제할까요? 연결된 사진도 함께 삭제됩니다.`)) return;

    setIsSaving(true);
    setLocalMessage(null);

    try {
      const response = await fetch(adminApiPath("/api/admin/places"), {
        body: JSON.stringify({ ids: [activePlace.id] }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setLocalMessage(body?.message ?? "장소카드 삭제에 실패했습니다.");
        return;
      }

      const nextPlace = data.places.find((place) => place.id !== activePlace.id) ?? null;
      setActivePlaceId(nextPlace?.id ?? null);
      removePlaceLocally(activePlace.id);
      setIsEditing(false);
      setLocalMessage("장소카드를 삭제했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const visiblePlaces = filteredPlaces.slice(0, 80);
  const previewPhotos = (publishedPhotos.length ? publishedPhotos : activePhotos).slice(0, 5);
  const phonePhoto = selectedPhoto?.public_url ?? coverPhoto?.public_url ?? previewPhotos[0]?.public_url ?? "";
  const phoneDotCount = Math.max(1, Math.min(5, publishedPhotos.length || previewPhotos.length || 1));
  const phoneActiveDotIndex = selectedPhotoSlot ? selectedPhotoSlot - 1 : 0;
  const photoCropStatusLabel =
    photoCropSaveState === "saving" ? "배치 자동저장 중"
      : photoCropSaveState === "saved" ? "배치 저장됨"
        : photoCropSaveState === "error" ? "배치 저장 실패"
          : "드래그/휠로 배치 조절";
  const selectedMoodTags = csvToList(draft.mood_tags).slice(0, 2);
  const selectedSituationTags = csvToList(draft.best_for);

  const countByNeighborhood = (id: string) => (
    id === "all"
      ? data.places.length
      : data.places.filter((place) => place.neighborhood_id === id).length
  );
  const countByCategory = (id: string) => (
    id === "all"
      ? data.places.length
      : data.places.filter((place) => normalizePlaceCategoryId(place.category_id, data.categories) === id).length
  );

  const placeExplorer = (
    <aside className="figma-admin-panel figma-place-explorer">
      <h2>장소 탐색</h2>
      <input
        className="figma-search"
        placeholder="장소명, 주소 검색"
        value={placeQuery}
        onChange={(event) => setPlaceQuery(event.target.value)}
      />
      <div className="figma-filter-section">
        <strong>동네</strong>
        <div className="figma-pill-row">
          <button className={activeNeighborhoodId === "all" ? "is-active" : ""} type="button" onClick={() => setActiveNeighborhoodId("all")}>전체</button>
          {data.neighborhoods.map((item) => (
            <button className={activeNeighborhoodId === item.id ? "is-active" : ""} key={item.id} type="button" onClick={() => setActiveNeighborhoodId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="figma-filter-section">
        <strong>장소유형</strong>
        <div className="figma-filter-list">
          <button className={activeCategoryId === "all" ? "is-active" : ""} type="button" onClick={() => setActiveCategoryId("all")}>
            <span>전체</span><em>{countByNeighborhood(activeNeighborhoodId)}</em>
          </button>
          {categoryOptions.map((item) => (
            <button className={activeCategoryId === item.id ? "is-active" : ""} key={item.id} type="button" onClick={() => setActiveCategoryId(item.id)}>
              <span>{item.name}</span><em>{countByCategory(item.id)}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="figma-filter-section figma-place-results">
        <strong>선택 결과</strong>
        <div className="figma-place-result-list">
          {visiblePlaces.length ? visiblePlaces.map((place) => {
            const photos = getAppPhotos(place);
            const thumbnail = getCoverPhoto(place, getPublishedPhotos(photos))?.public_url ?? photos[0]?.public_url;
            return (
              <button
                className={activePlace?.id === place.id ? "is-selected" : ""}
                key={place.id}
                type="button"
                onClick={() => setActivePlaceId(place.id)}
              >
                <span className="figma-place-thumb" style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined} />
                <span>
                  <b>{place.name ?? "이름 없는 장소"}</b>
                  <em>{formatCategory(place.category_id, data.categories)} · 사진 {getPlacePhotoCount(place)} · {placeStatusLabel(place.status)}</em>
                </span>
                <i />
              </button>
            );
          }) : <EmptyState label="조건에 맞는 장소가 없습니다." />}
        </div>
      </div>
    </aside>
  );

  const overlays = (
    <>
      {isAddressSearchOpen ? (
        <AddressSearchOverlay
          initialQuery={draft.address}
          onClose={() => setIsAddressSearchOpen(false)}
          onSelect={selectAddress}
        />
      ) : null}
      {isProviderPickerOpen ? (
        <ProviderSearchOverlay
          isSaving={isSaving}
          onClose={() => setIsProviderPickerOpen(false)}
          onQueryChange={setProviderQuery}
          onSelect={(provider) => void saveSelectedPhotoProvider(provider)}
          options={visibleProviderOptions}
          photo={selectedPhoto}
          query={providerQuery}
          selectedProviderKey={selectedProvider?.key}
        />
      ) : null}
    </>
  );

  if (!data.places.length) {
    return (
      <div className="figma-admin-page">
        <EmptyState label="장소 데이터가 없습니다." />
      </div>
    );
  }

  if (isManage) {
    return (
      <div className="figma-admin-page photo-management-page">
        {isSaving ? <ActionBusyPanel label="저장 중" /> : null}
        <header className="figma-admin-header">
          <div>
            <h1>사진관리</h1>
            <p>사진을 선택하고 앱 장소카드에 보이는 배치를 바로 확인</p>
          </div>
        </header>
        <div className="figma-photo-management-layout">
          {placeExplorer}
          <section className="figma-admin-panel figma-photo-workbench">
            <div className="figma-panel-head">
              <div>
                <h2>사진 선택/배치</h2>
                <p>{activePlace?.name ?? "-"} 사진을 앱 노출 슬롯에 배치</p>
              </div>
              <span>{activePhotos.length}장 중 {publishedPhotos.length}장 게시</span>
            </div>
            {localMessage ? <div className="inline-warning">{localMessage}</div> : null}
            <div className="figma-photo-toolbar">
              <button className={`btn ${isPhotoSelectMode ? "primary" : "ghost"}`} disabled={!activePhotos.length || isSaving} type="button" onClick={() => {
                setIsPhotoSelectMode((current) => !current);
                setSelectedPhotoIds([]);
              }}>
                {isPhotoSelectMode ? "선택 종료" : "사진 선택"}
              </button>
              {isPhotoSelectMode ? (
                <>
                  <span>선택 {selectedPhotoIds.length}/5</span>
                  <button className="btn ghost" disabled={!selectedPhotoIds.length || isSaving} type="button" onClick={() => setSelectedPhotoIds([])}>선택 해제</button>
                  <button className="btn danger" disabled={!selectedPhotoIds.length || isSaving} type="button" onClick={() => void deleteSelectedPhotos()}>선택 삭제</button>
                  <button className="btn primary" disabled={!selectedPhotoIds.length || selectedPhotoIds.length > 5 || isSaving} type="button" onClick={() => void activateSelectedPhotos()}>선택 활성화</button>
                </>
              ) : (
                <>
                  <button className="btn ghost" disabled={!selectedPhoto} type="button" onClick={() => selectedPhoto ? openPhotoProviderDialog(selectedPhoto) : undefined}>제공자 지정</button>
                  <button className="btn ghost" disabled={!selectedPhoto} type="button" onClick={() => void saveCoverPhoto(selectedPhoto)}>대표사진 설정</button>
                  <button className="btn danger" disabled={!selectedPhoto || isSaving} type="button" onClick={() => selectedPhoto ? void deletePhoto(selectedPhoto) : undefined}>선택 사진 삭제</button>
                </>
              )}
            </div>
            <div className="figma-section-label"><strong>사진 라이브러리</strong><span>앱에 노출할 사진을 선택</span></div>
            <div className="figma-library-grid">
              {activePhotos.length ? activePhotos.map((photo, index) => {
                const isSelectedForAction = Boolean(photo.id && selectedPhotoIds.includes(photo.id));
                const publishedSlot = publishedPhotoSlotByKey.get(getPhotoKey(photo));
                return (
                  <button
                    className={`${selectedPhotoIndex === index ? "is-active" : ""} ${isSelectedForAction ? "is-checked" : ""}`}
                    key={`${photo.public_url}-${index}`}
                    style={{ backgroundImage: `url(${photo.public_url})` }}
                    type="button"
                    onClick={() => {
                      if (isPhotoSelectMode) {
                        togglePhotoSelection(photo);
                        return;
                      }
                      setSelectedPhotoIndex(index);
                    }}
                  >
                    <span>{index + 1}</span>
                    {publishedSlot ? <em>{publishedSlot}번</em> : null}
                    {isSelectedForAction ? <i>✓</i> : null}
                  </button>
                );
              }) : <EmptyState label="연결된 사진이 없습니다." />}
            </div>
            <div className="figma-section-label"><strong>앱 노출 슬롯</strong><span>순서대로 앱 카드에 사용됨</span></div>
            <div className="figma-slot-row">
              {Array.from({ length: 5 }).map((_, index) => {
                const photo = publishedPhotos[index];
                const isActive = photo && getPhotoKey(photo) === getPhotoKey(selectedPhoto);
                return (
                  <button
                    className={isActive ? "is-active" : ""}
                    disabled={!photo}
                    key={`slot-${index}`}
                    style={photo?.public_url ? { backgroundImage: `url(${photo.public_url})` } : undefined}
                    type="button"
                    onClick={() => {
                      if (!photo) return;
                      const nextIndex = activePhotos.findIndex((item) => getPhotoKey(item) === getPhotoKey(photo));
                      if (nextIndex >= 0) setSelectedPhotoIndex(nextIndex);
                    }}
                  >
                    <span>{index + 1}번</span>
                    {isActive ? <em>편집중</em> : null}
                  </button>
                );
              })}
            </div>
            <div className="figma-edit-note">
              <strong>편집 방식</strong>
              <span>오른쪽 폰 화면에서 사진을 드래그해서 위치 이동, 스크롤로 확대/축소. 저장값은 앱 카드에 그대로 반영</span>
            </div>
          </section>
          <aside className="figma-admin-panel figma-phone-preview-panel">
            <h2>앱 미리보기</h2>
            <p>실제 유저가 보는 장소카드 기준</p>
            <div className="figma-phone">
              <div className="figma-phone-notch" />
              <div className="figma-phone-screen">
                <div className="figma-phone-top"><strong>{activeNeighborhood} · {activeCategory}</strong><span>{Math.min(phoneActiveDotIndex + 1, phoneDotCount)} / {phoneDotCount}</span></div>
                <article className="admin-real-place-card">
                  <div
                    className="admin-real-photo-shell"
                    onPointerCancel={endPhotoCropDrag}
                    onPointerDown={startPhotoCropDrag}
                    onPointerMove={movePhotoCropDrag}
                    onPointerUp={endPhotoCropDrag}
                    onWheel={zoomPhotoCrop}
                    role="presentation"
                  >
                    {phonePhoto ? (
                      <img
                        alt={`${activePlace?.name ?? "장소"} 사진`}
                        draggable={false}
                        src={phonePhoto}
                        style={photoCropStyle(selectedPhotoCrop)}
                      />
                    ) : (
                      <span>사진 없음</span>
                    )}
                  </div>
                  <div className="admin-real-photo-dots" aria-label={`사진 ${Math.min(phoneActiveDotIndex + 1, phoneDotCount)}/${phoneDotCount}`}>
                    {Array.from({ length: phoneDotCount }).map((_, index) => <i className={index === phoneActiveDotIndex ? "is-active" : ""} key={index} />)}
                  </div>
                  <button className="admin-real-tap-zone left" type="button" aria-label="이전 사진" />
                  <button className="admin-real-tap-zone right" type="button" aria-label="다음 사진" />
                  <div className="admin-real-creator-badge">
                    <span />
                    <strong>Doripe</strong>
                    <em>✓</em>
                    <small>공식 큐레이션</small>
                  </div>
                  <div className="admin-real-place-info">
                    <button className="admin-real-action info" type="button" aria-label="상세 정보"><img src="/app/assets/figma-info.svg" alt="" /></button>
                    <div className="admin-real-tag-row">
                      {[...selectedMoodTags, ...selectedSituationTags].slice(0, 3).map((tag, index) => <span className={index === 0 ? "mood" : "situation"} key={`${tag}-${index}`}>{tag}</span>)}
                      {!selectedMoodTags.length && !selectedSituationTags.length ? <span>{activeCategory}</span> : null}
                    </div>
                    <h3>{activePlace?.name ?? "-"}</h3>
                    <p>{activePlace?.short_copy || activePlace?.address || "연남에서 발견한 장소"}</p>
                    <button className="admin-real-action skip" type="button" aria-label="넘기기"><img src="/app/assets/figma-x.svg" alt="" /></button>
                    <button className="admin-real-action heart" type="button" aria-label="저장"><img src="/app/assets/figma-heart.svg" alt="" /></button>
                  </div>
                </article>
              </div>
            </div>
            <div className="figma-preview-status">{photoCropStatusLabel} · 슬롯 {selectedPhotoSlot ?? "-"}번 · {selectedPhotoCrop.zoom.toFixed(2)}x</div>
            <button className="btn ghost" disabled={!selectedPhoto || photoCropSaveState === "saving"} type="button" onClick={resetSelectedPhotoCrop}>배치 초기화</button>
          </aside>
        </div>
        {overlays}
      </div>
    );
  }

  return (
    <div className="figma-admin-page place-card-management-page">
      {isSaving ? <ActionBusyPanel label="저장 중" /> : null}
      <header className="figma-admin-header">
        <div>
          <h1>장소카드관리</h1>
          <p>장소 정보, 사진 미리보기, 알고리즘 태그를 한 화면에서 관리</p>
        </div>
        <div className="figma-header-actions">
          <button className="btn danger" disabled={!activePlace || isSaving} type="button" onClick={() => void deletePlaceCard()}>
            {isSaving ? <LoadingSpinner label="처리 중" /> : "장소삭제"}
          </button>
          <button className="btn primary" type="button" onClick={openPlaceAddMethodDialog}>{icons.plus}장소 추가하기</button>
        </div>
      </header>
      <div className="figma-place-card-layout">
        {placeExplorer}
        <section className="figma-admin-panel figma-place-detail">
          <div className="figma-panel-head">
            <div>
              <h2>{activePlace?.name ?? "-"}</h2>
              <p>{activeNeighborhood} · {activeCategory}</p>
            </div>
            <div className="figma-status-row">
              <span>{isSaving ? "저장중" : localMessage ?? "자동저장됨"}</span>
              <PlaceStatusToggle disabled={!activePlace || isSaving} value={activePlace?.status} onChange={(nextStatus) => void savePlaceStatus(nextStatus)} />
            </div>
          </div>
          {localMessage ? <div className="inline-warning">{localMessage}</div> : null}
          <div className="figma-section-label"><strong>사진 미리보기</strong><a href={`${adminBasePath}/content/photo_management`}>사진관리하기</a></div>
          <div className="figma-card-photo-strip">
            {Array.from({ length: 5 }).map((_, index) => {
              const photo = previewPhotos[index];
              const isCover = Boolean(photo && isCoverPhoto(activePlace, photo));
              return (
                <button
                  className={`${isCover ? "is-cover" : ""} ${selectedPhotoIndex === index ? "is-active" : ""}`}
                  disabled={!photo}
                  key={`preview-${index}`}
                  style={photo?.public_url ? { backgroundImage: `url(${photo.public_url})` } : undefined}
                  type="button"
                  onClick={() => {
                    if (!photo) return;
                    const nextIndex = activePhotos.findIndex((item) => getPhotoKey(item) === getPhotoKey(photo));
                    if (nextIndex >= 0) setSelectedPhotoIndex(nextIndex);
                  }}
                >
                  <span>{index + 1}</span>
                  {isCover ? <em>대표</em> : null}
                </button>
              );
            })}
          </div>
          <div className="figma-section-label"><strong>기본정보</strong></div>
          <fieldset className="figma-place-form">
            <label><span>장소명</span><input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></label>
            <label><span>장소유형</span><select value={draft.category_id} onChange={(event) => updateDraft("category_id", event.target.value)}>{editableCategoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="span-2"><span>주소</span><input value={draft.address} onChange={(event) => updateDraft("address", event.target.value)} /></label>
            <label className="span-2"><span>네이버지도 URL</span><input value={draft.naver_place_url} onChange={(event) => updateDraft("naver_place_url", event.target.value)} /></label>
            <label><span>영업시간</span><input value={draft.hours_text} onChange={(event) => updateDraft("hours_text", event.target.value)} /></label>
            <label><span>연락처</span><input value={draft.phone_text} onChange={(event) => updateDraft("phone_text", event.target.value)} /></label>
            <label><span>대표메뉴</span><input value={draft.representative_menu_name} onChange={(event) => updateDraft("representative_menu_name", event.target.value)} /></label>
            <label><span>가격</span><input value={draft.representative_menu_price} onChange={(event) => updateDraft("representative_menu_price", event.target.value)} /></label>
            <label className="span-2"><span>인스타그램</span><input value={draft.instagram_url} onChange={(event) => updateDraft("instagram_url", event.target.value)} /></label>
            <label className="span-2"><span>장소카드 뒷면 문구</span><textarea value={draft.editorial_note} onChange={(event) => updateDraft("editorial_note", event.target.value)} /></label>
          </fieldset>
        </section>
        <aside className="figma-admin-panel figma-algorithm-panel">
          <div className="figma-panel-head">
            <div>
              <h2>알고리즘 설정</h2>
              <p>vector_tags</p>
            </div>
          </div>
          <div className="figma-vector-section">
            <strong>공통 벡터</strong>
            <TagChoiceGroup helperText="분위기는 최대 2개까지 선택합니다." label="분위기 태그" max={2} options={moodOptions} value={selectedMoodTags} onChange={(next) => updateDraft("mood_tags", listToCsv(next.slice(0, 2)))} />
          </div>
          <div className="figma-vector-section">
            <strong>카페 벡터</strong>
            <TagChoiceGroup label="상황 태그" options={situationOptions} value={selectedSituationTags} onChange={(next) => updateDraft("best_for", listToCsv(next))} />
          </div>
          <button className="btn primary figma-save-button" disabled={isSaving} type="button" onClick={() => void savePlaceCard()}>{isSaving ? <LoadingSpinner label="저장 중" /> : "지금 저장"}</button>
        </aside>
      </div>
      {overlays}
    </div>
  );
}

function ContentView({
  closeDialog,
  data,
  onDataChange,
  onRefreshData,
  openDialog,
  subTab,
}: {
  closeDialog: () => void;
  data: OpsData;
  onDataChange: OpsDataUpdater;
  onRefreshData: () => Promise<void>;
  openDialog: OpenDialog;
  subTab: SubTabId;
}) {
  const [editingTagSections, setEditingTagSections] = useState<Record<string, boolean>>({});
  const [tagMessage, setTagMessage] = useState<string | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [isTagSaving, setIsTagSaving] = useState(false);
  const photoCount = data.places.reduce((sum, place) => sum + getPlacePhotoCount(place), 0);
  const readyPlaces = data.places.filter((place) => place.status === "ready").length;
  const draftPlaces = data.places.filter((place) => place.status !== "ready").length;
  const moodTags = useMemo(() => getManagedTags(data, "mood", "mood_tags"), [data]);
  const situationTags = useMemo(() => getManagedTags(data, "situation", "best_for"), [data]);
  const providerOptions = useMemo(() => buildPhotoProviderOptions(data.submissions), [data.submissions]);
  const neighborhoodRows = data.neighborhoods.map((neighborhood) => {
    const places = data.places.filter((place) => place.neighborhood_id === neighborhood.id);
    return [
      neighborhood.name,
      fmtNumber(places.reduce((sum, place) => sum + getPlacePhotoCount(place), 0)),
      fmtNumber(places.filter((place) => place.status === "ready").length),
      fmtNumber(places.filter((place) => place.status !== "ready").length),
      fmtNumber(places.reduce((sum, place) => sum + (place.status === "ready" ? getPlacePhotoCount(place) : 0), 0)),
    ];
  });
  const categoryStats = data.categories.map((category) => {
    const count = data.places.filter((place) => place.category_id === category.id).length;
    return `${category.name} ${fmtNumber(count)}`;
  }).filter((item) => !item.endsWith(" 0"));

  function tagDraftKey(sectionKey: string, itemId: string) {
    return `${sectionKey}:${itemId}`;
  }

  function updateTagDraft(sectionKey: string, itemId: string, value: string) {
    setTagDrafts((current) => ({ ...current, [tagDraftKey(sectionKey, itemId)]: value }));
  }

  function resetTagDraft(sectionKey: string, itemId: string) {
    setTagDrafts((current) => {
      const next = { ...current };
      delete next[tagDraftKey(sectionKey, itemId)];
      return next;
    });
  }

  function toggleTagEditing(sectionKey: string) {
    setEditingTagSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  }

  async function saveCategoryTag(category: OpsData["categories"][number] | undefined, forcedName?: string) {
    const currentName = category?.name ?? "";
    const nextName = (forcedName ?? window.prompt("장소 유형 이름", currentName) ?? "").trim();
    if (!nextName || nextName === currentName) return;

    setIsTagSaving(true);
    setTagMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/categories"), {
        body: JSON.stringify({
          display_order: category ? data.categories.findIndex((item) => item.id === category.id) : data.categories.length,
          id: category?.id ?? `category-${Date.now().toString(36)}`,
          name: nextName,
          status: "active",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setTagMessage(body?.message ?? "장소 유형 저장에 실패했습니다.");
        return;
      }

      await onRefreshData();
      setTagMessage("장소 유형을 저장했습니다.");
    } finally {
      setIsTagSaving(false);
    }
  }

  async function deleteCategoryTag(category: OpsData["categories"][number]) {
    if (isUncategorizedCategory(category)) {
      setTagMessage("미분류는 장소 유형이 사라진 장소의 기본값이라 삭제할 수 없습니다.");
      return;
    }

    const confirmed = window.confirm(`${category.name} 장소 유형을 삭제할까요?`);
    if (!confirmed) return;

    const fallbackCategory = data.categories.find(isUncategorizedCategory)
      ?? { id: UNCATEGORIZED_CATEGORY_ID, name: UNCATEGORIZED_CATEGORY_NAME };
    const targets = data.places.filter((place) => place.category_id === category.id);

    setIsTagSaving(true);
    setTagMessage(null);
    try {
      const fallbackResponse = await fetch(adminApiPath("/api/admin/categories"), {
        body: JSON.stringify({
          display_order: data.categories.findIndex((item) => item.id === fallbackCategory.id) >= 0
            ? data.categories.findIndex((item) => item.id === fallbackCategory.id)
            : data.categories.length,
          id: fallbackCategory.id,
          name: fallbackCategory.name,
          status: "active",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!fallbackResponse.ok) {
        const body = await fallbackResponse.json().catch(() => null);
        setTagMessage(body?.message ?? "미분류 유형 생성에 실패했습니다.");
        return;
      }

      if (targets.length) {
        const placeResponses = await Promise.all(targets.map((place) => (
          fetch(adminApiPath("/api/admin/places"), {
            body: JSON.stringify(makePlacePayloadFromRow(place, data, { category_id: fallbackCategory.id })),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        )));

        const failedPlace = placeResponses.find((response) => !response.ok);
        if (failedPlace) {
          const body = await failedPlace.json().catch(() => null);
          setTagMessage(body?.message ?? "장소를 미분류로 이동하지 못했습니다.");
          return;
        }
      }

      const response = await fetch(adminApiPath("/api/admin/categories"), {
        body: JSON.stringify({
          display_order: data.categories.findIndex((item) => item.id === category.id),
          id: category.id,
          name: category.name,
          status: "inactive",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setTagMessage(body?.message ?? "장소 유형 삭제에 실패했습니다.");
        return;
      }

      await onRefreshData();
      setTagMessage(`${category.name} 장소 유형을 삭제했고, 연결된 장소 ${targets.length}개를 미분류로 이동했습니다.`);
    } finally {
      setIsTagSaving(false);
    }
  }

  async function replaceTagOnPlaces(field: "best_for" | "mood_tags" | "time_tags", oldTag: string, nextTag: string) {
    const targets = data.places.filter((place) => (place[field] ?? []).includes(oldTag));
    if (!targets.length) return true;

    const responses = await Promise.all(targets.map((place) => {
      const nextTags = Array.from(new Set((place[field] ?? []).map((tag) => tag === oldTag ? nextTag : tag)));
      return fetch(adminApiPath("/api/admin/places"), {
        body: JSON.stringify(makePlacePayloadFromRow(place, data, { [field]: nextTags })),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    }));

    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const body = await failed.json().catch(() => null);
      setTagMessage(body?.message ?? "태그 저장에 실패했습니다.");
      return false;
    }

    return true;
  }

  async function removeTagFromPlaces(field: "best_for" | "mood_tags" | "time_tags", tagName: string) {
    const targets = data.places.filter((place) => (place[field] ?? []).includes(tagName));
    if (!targets.length) return true;

    const responses = await Promise.all(targets.map((place) => (
      fetch(adminApiPath("/api/admin/places"), {
        body: JSON.stringify(makePlacePayloadFromRow(place, data, { [field]: (place[field] ?? []).filter((tag) => tag !== tagName) })),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    )));

    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const body = await failed.json().catch(() => null);
      setTagMessage(body?.message ?? "태그 삭제에 실패했습니다.");
      return false;
    }

    return true;
  }

  async function saveContentTag(kind: ContentTagKind, currentName?: string, forcedName?: string) {
    const nextName = (forcedName ?? window.prompt(`${kind === "mood" ? "분위기" : kind === "situation" ? "상황" : "시간"} 태그 이름`, currentName ?? "") ?? "").trim();
    if (!nextName || nextName === currentName) return;

    const currentTag = currentName ? findManagedTag(data, kind, currentName) : null;
    const field = tagFieldByKind[kind];

    setIsTagSaving(true);
    setTagMessage(null);
    try {
      const response = await fetch(adminApiPath("/api/admin/tags"), {
        body: JSON.stringify({
          display_order: data.contentTags.filter((tag) => tag.kind === kind).length,
          id: currentTag?.id,
          kind,
          name: nextName,
          status: "active",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setTagMessage(body?.message ?? "태그 저장에 실패했습니다.");
        return;
      }

      if (currentName && currentName !== nextName) {
        const updated = await replaceTagOnPlaces(field, currentName, nextName);
        if (!updated) return;
      }

      await onRefreshData();
      setTagMessage(currentName ? `${currentName} 태그를 ${nextName}로 바꿨습니다.` : `${nextName} 태그를 추가했습니다.`);
    } finally {
      setIsTagSaving(false);
    }
  }

  async function deleteContentTag(kind: ContentTagKind, currentName: string) {
    const confirmed = window.confirm(`${currentName} 태그를 삭제할까요?`);
    if (!confirmed) return;

    const currentTags = data.contentTags.filter((tag) => tag.kind === kind && tag.name === currentName && tag.status !== "inactive");
    const field = tagFieldByKind[kind];

    setIsTagSaving(true);
    setTagMessage(null);
    try {
      if (currentTags.length) {
        const responses = await Promise.all(currentTags.map((currentTag) => fetch(adminApiPath("/api/admin/tags"), {
          body: JSON.stringify({
            display_order: currentTag.display_order ?? 0,
            id: currentTag.id,
            kind,
            name: currentName,
            status: "inactive",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })));

        const failed = responses.find((response) => !response.ok);
        if (failed) {
          const body = await failed.json().catch(() => null);
          setTagMessage(body?.message ?? "태그 삭제에 실패했습니다.");
          return;
        }
      }

      const removed = await removeTagFromPlaces(field, currentName);
      if (!removed) return;

      await onRefreshData();
      setTagMessage(`${currentName} 태그를 삭제했습니다.`);
    } finally {
      setIsTagSaving(false);
    }
  }

  if (subTab === "tag_management") {
    const tagSections = [
      {
        add: () => void saveCategoryTag(undefined),
        editKey: "category",
        items: normalCategoryOptions(data.categories).map((item) => ({
          id: item.id,
          label: item.name,
          onDelete: () => void deleteCategoryTag(item),
          onRename: (nextName: string) => void saveCategoryTag(item, nextName),
        })),
        title: "장소 유형",
      },
      {
        add: () => void saveContentTag("mood"),
        editKey: "mood",
        items: moodTags.map((tag) => ({
          id: `mood-${tag}`,
          label: tag,
          onDelete: () => void deleteContentTag("mood", tag),
          onRename: (nextName: string) => void saveContentTag("mood", tag, nextName),
        })),
        title: "분위기",
      },
      {
        add: () => void saveContentTag("situation"),
        editKey: "situation",
        items: situationTags.map((tag) => ({
          id: `situation-${tag}`,
          label: tag,
          onDelete: () => void deleteContentTag("situation", tag),
          onRename: (nextName: string) => void saveContentTag("situation", tag, nextName),
        })),
        title: "상황",
      },
    ];

    return (
      <>
        <SectionIntro eyebrow="Content" title="태그 관리" description="장소 유형, 분위기, 상황 태그를 섹션별로 관리합니다." />
        {tagMessage ? <div className="inline-warning tag-manager-message">{tagMessage}</div> : null}
        <div className="tag-manager-grid">
          {tagSections.map((section) => (
            <Card
              actions={(
                <div className="action-row">
                  <button className="btn ghost" disabled={isTagSaving} type="button" onClick={() => toggleTagEditing(section.editKey)}>
                    {editingTagSections[section.editKey] ? "완료" : "수정"}
                  </button>
                  <button className="btn primary" disabled={isTagSaving} type="button" onClick={section.add}>{icons.plus}추가</button>
                </div>
              )}
              eyebrow="Tags"
              key={section.title}
              title={section.title}
            >
              <div className="tag-cloud">
                {section.items.length ? section.items.map((item) => {
                  const draftKey = tagDraftKey(section.editKey, item.id);
                  const draftValue = tagDrafts[draftKey] ?? item.label;
                  const isEditing = Boolean(editingTagSections[section.editKey]);

                  return (
                    <div className={`tag-manage-row ${isEditing ? "is-editing" : ""}`} key={item.id}>
                      {isEditing ? (
                        <>
                          <input
                            aria-label={`${item.label} 태그 이름`}
                            disabled={isTagSaving}
                            value={draftValue}
                            onBlur={() => {
                              const nextName = draftValue.trim();
                              resetTagDraft(section.editKey, item.id);
                              if (nextName && nextName !== item.label) item.onRename(nextName);
                            }}
                            onChange={(event) => updateTagDraft(section.editKey, item.id, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                                return;
                              }
                              if (event.key === "Escape") {
                                resetTagDraft(section.editKey, item.id);
                                event.currentTarget.blur();
                              }
                            }}
                          />
                          <button
                            aria-label={`${item.label} 태그 삭제`}
                            className="tag-delete-button"
                            disabled={isTagSaving}
                            type="button"
                            onClick={item.onDelete}
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            x
                          </button>
                        </>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </div>
                  );
                }) : <EmptyState label={`${section.title} 태그 데이터가 아직 없습니다.`} />}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (subTab === "scrap_management") {
    return <ScrapManagementView />;
  }

  if (subTab === "photo_review") {
    return (
      <MediaLibrary
        closeDialog={closeDialog}
        data={data}
        mode="review"
        onDataChange={onDataChange}
        onRefreshData={onRefreshData}
        openDialog={openDialog}
        providerOptions={providerOptions}
      />
    );
  }

  if (subTab === "photo_management") {
    return (
      <MediaLibrary
        closeDialog={closeDialog}
        data={data}
        mode="manage"
        onDataChange={onDataChange}
        onRefreshData={onRefreshData}
        openDialog={openDialog}
        providerOptions={providerOptions}
      />
    );
  }

  return (
    <>
      <SectionIntro eyebrow="Content" title="콘텐츠 대시보드" description="동네별 사진/활성 장소/활성 사진, 태그별 장소 수를 한눈에 봅니다." />
      <div className="grid two">
        <Card eyebrow="Neighborhoods" title="동네별 콘텐츠 상태">
          {neighborhoodRows.length ? <DataTable headers={["동네", "사진 수", "게시 장소", "대기 장소", "게시 장소 사진"]} rows={neighborhoodRows} /> : <EmptyState label="동네 데이터가 없습니다." />}
        </Card>
        <Card eyebrow="Tags" title="태그별 장소 수">
          <div className="tag-stat-grid">
            {categoryStats.length ? categoryStats.map((item) => <span key={item}>{item}</span>) : <EmptyState label="태그별 장소 데이터가 없습니다." />}
          </div>
        </Card>
      </div>
      <div className="grid four content-kpis">
        <Card eyebrow="All" title="전체 사진"><div className="metric-line"><strong>{photoCount}</strong><span>등록 사진</span></div></Card>
        <Card eyebrow="Published" title="게시 장소"><div className="metric-line"><strong>{readyPlaces}</strong><span>앱 노출 가능</span></div></Card>
        <Card eyebrow="Draft" title="대기 장소"><div className="metric-line"><strong>{draftPlaces}</strong><span>아직 앱 미노출</span></div></Card>
        <Card eyebrow="Published" title="게시 장소 사진"><div className="metric-line"><strong>{data.places.filter((place) => place.status === "ready").reduce((sum, place) => sum + getPlacePhotoCount(place), 0)}</strong><span>앱 카드 연결</span></div></Card>
      </div>
    </>
  );
}

function SettingsView({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="grid two-wide">
      <Card eyebrow="Admin" title="관리자">
        <div className="mini-list">
          <p><strong>인증 방식</strong><span>관리자 비밀번호</span></p>
          <p><strong>세션</strong><span>HTTP-only 쿠키</span></p>
          <p><strong>권한</strong><span>MVP 단일 관리자</span></p>
        </div>
      </Card>
      <Card eyebrow="System" title="시스템/API 상태">
        <div className="mini-list">
          <p><strong>Supabase</strong><span>연결 필요 시 API별 점검</span></p>
          <p><strong>이미지 업로드</strong><span>장소별 사진 연결 관리</span></p>
        </div>
        <button className="btn danger" type="button" onClick={onLogout}>로그아웃</button>
      </Card>
    </div>
  );
}

function Modal({ dialog, onClose }: { dialog: DialogState; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{dialog.title}</h2>
            {dialog.description ? <p>{dialog.description}</p> : null}
          </div>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{dialog.body}</div>
        {dialog.hideActions ? null : (
          <div className="modal-actions">
            <button className="btn ghost" type="button" onClick={onClose}>취소</button>
            <button className="btn primary" type="button" onClick={onClose}>{dialog.confirmLabel ?? "저장"}</button>
          </div>
        )}
      </section>
    </div>
  );
}

function AuthCheckingScreen() {
  return (
    <main className="auth-checking-shell">
      <section className="auth-checking-card" aria-live="polite" aria-busy="true">
        <div className="auth-checking-logo"><DoripeLogo /></div>
        <h1>Doripe admin<span>.</span></h1>
        <p>관리자 확인 중...</p>
      </section>
    </main>
  );
}

export function AdminShell({ initialAuthed }: { initialAuthed: boolean }) {
  const initialNav = useMemo(() => initialAdminNavState(), []);
  const [activeTab, setActiveTab] = useState<TabId>(initialNav.activeTab);
  const [activeSubTabs, setActiveSubTabs] = useState<Record<TabId, SubTabId | null>>(initialNav.activeSubTabs);
  const [authed, setAuthed] = useState(initialAuthed);
  const [data, setData] = useState<OpsData>(emptyOpsData);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(initialAuthed);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<AdminStats>(emptyStats);

  const activeItem = useMemo(() => navItems.find((item) => item.id === activeTab) ?? navItems[0], [activeTab]);
  const activeSubTab = activeSubTabs[activeTab];
  const activeSubTabLabel = activeItem.subTabs?.find((item) => item.id === activeSubTab)?.label;

  const loadAdminData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [placesResponse, submissionsResponse, statsResponse, tagsResponse] = await Promise.all([
        fetch(adminApiPath("/api/admin/places?status=all"), { cache: "no-store" }),
        fetch(adminApiPath("/api/admin/creator-submissions?status=all"), { cache: "no-store" }),
        fetch(adminApiPath("/api/admin/stats"), { cache: "no-store" }),
        fetch(adminApiPath("/api/admin/tags"), { cache: "no-store" }),
      ]);

      if (
        placesResponse.status === 401
        || submissionsResponse.status === 401
        || statsResponse.status === 401
        || tagsResponse.status === 401
      ) {
        setAuthed(false);
        return;
      }

      const placesPayload = placesResponse.ok ? await placesResponse.json().catch(() => null) : null;
      const submissionsPayload = submissionsResponse.ok ? await submissionsResponse.json().catch(() => null) : null;
      const statsPayload = statsResponse.ok ? await statsResponse.json().catch(() => null) : null;
      const tagsPayload = tagsResponse.ok ? await tagsResponse.json().catch(() => null) : null;

      setData({
        categories: placesPayload?.categories ?? [],
        contentTags: tagsPayload?.tags ?? [],
        neighborhoods: placesPayload?.neighborhoods ?? [],
        places: placesPayload?.places ?? [],
        submissions: submissionsPayload?.submissions ?? [],
      });
      setStats(statsPayload ?? emptyStats);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  const updateAdminRoute = useCallback((tabId: TabId, subTabId: SubTabId | null, mode: "push" | "replace" = "push") => {
    if (typeof window === "undefined") return;
    const nextPath = adminRoutePath(tabId, subTabId);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath === nextPath) return;
    window.history[mode === "replace" ? "replaceState" : "pushState"]({ tabId, subTabId }, "", nextPath);
  }, []);

  function activateAdminTab(tabId: TabId, subTabId: SubTabId | null, options: { updateUrl?: boolean; replace?: boolean } = {}) {
    setActiveTab(tabId);
    setActiveSubTabs((current) => ({ ...current, [tabId]: subTabId }));
    if (options.updateUrl !== false) updateAdminRoute(tabId, subTabId, options.replace ? "replace" : "push");
  }

  function selectTab(item: NavItem) {
    const subTab = item.subTabs?.length ? activeSubTabs[item.id] ?? item.subTabs[0]?.id ?? null : null;
    activateAdminTab(item.id, subTab);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setIsCheckingAuth(false), 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authed) return;

    let isMounted = true;

    void loadAdminData().catch((error) => {
      if (isMounted) setMessage(error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했어요.");
    });

    return () => {
      isMounted = false;
    };
  }, [authed, loadAdminData]);

  useEffect(() => {
    updateAdminRoute(activeTab, activeSubTabs[activeTab], "replace");
  }, [activeSubTabs, activeTab, updateAdminRoute]);

  useEffect(() => {
    function syncFromBrowserHistory() {
      const next = initialAdminNavState();
      setActiveTab(next.activeTab);
      setActiveSubTabs(next.activeSubTabs);
    }

    window.addEventListener("popstate", syncFromBrowserHistory);
    return () => window.removeEventListener("popstate", syncFromBrowserHistory);
  }, []);

  async function login() {
    setIsLoading(true);
    setMessage(null);
    const response = await fetch(adminApiPath("/api/admin/login"), {
      body: JSON.stringify({ password }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setIsLoading(false);

    if (!response.ok) {
      setMessage(response.status === 429 ? "로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요." : "비밀번호가 맞지 않아요.");
      return;
    }

    setAuthed(true);
    setPassword("");
  }

  async function logout() {
    await fetch(adminApiPath("/api/admin/logout"), { method: "POST" });
    setAuthed(false);
    setActiveTab("dashboard");
    setActiveSubTabs(defaultActiveSubTabs());
    updateAdminRoute("dashboard", null, "replace");
    setData(emptyOpsData);
    setStats(emptyStats);
  }

  if (isCheckingAuth) {
    return <AuthCheckingScreen />;
  }

  if (!authed) {
    return (
      <main className="auth-shell">
        <aside className="auth-aside">
          <div className="auth-brand">
            <div className="logo"><DoripeLogo /></div>
            <div className="name">Doripe Admin</div>
          </div>
          <div className="auth-aside-body">
            <span className="auth-aside-eyebrow">MVP OPERATIONS</span>
            <h1>유저, 사진제공자, 가게를 한 곳에서 봅니다.</h1>
            <p>Doripe의 퍼널과 운영 데이터를 확인하는 내부 관리자 화면입니다.</p>
            <div className="auth-quote">
              광고 유입부터 장소 저장, 루트 생성, 공유까지 MVP 검증에 필요한 숫자만 남깁니다.
              <div className="auth-quote-author">
                <div className="av"><DoripeLogo /></div>
                <div>Doripe Operations</div>
              </div>
            </div>
          </div>
          <div className="auth-aside-footer">
            <span>© 2026</span>
            <span>DORIPE INTERNAL</span>
          </div>
        </aside>

        <section className="auth-main">
          <div className="auth-main-top">
            <span>Doripe admin</span>
            <span>관리자 전용</span>
          </div>
          <div className="auth-card">
            <h2>관리자 로그인</h2>
            <p className="sub">관리자 비밀번호만 입력하면 됩니다.</p>
            <div className="auth-form">
              <label className="auth-field">
                <span className="field-label">비밀번호</span>
                <span className="input-icon">
                  <span className="ico">{icons.lock}</span>
                  <input
                    autoFocus
                    className="input"
                    placeholder="관리자 비밀번호"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && password) void login();
                    }}
                  />
                </span>
              </label>
              {message ? <p className="message">{message}</p> : null}
              <button className="auth-submit" disabled={isLoading || !password} type="button" onClick={() => void login()}>
                {isLoading ? <LoadingSpinner label="확인 중" /> : <>들어가기 {icons.arrow}</>}
              </button>
            </div>
          </div>
          <div className="auth-main-bottom">관리자 외 접근 금지 · noindex</div>
        </section>
      </main>
    );
  }

  const showInitialDataLoader = isDataLoading && data.places.length === 0 && data.neighborhoods.length === 0;

  return (
    <main className="shell">
      <aside className="d-sidebar">
        <div className="brand">
          <div className="brand-logo"><DoripeLogo /></div>
          <div className="brand-text">
            <div className="brand-name">Doripe</div>
            <div className="brand-tag">MVP OPS</div>
          </div>
        </div>

        <nav className="nav-section" aria-label="Doripe admin">
          <div className="nav-label">Workspace</div>
          {navItems.slice(0, 6).map((item) => (
            <div className={`nav-group ${activeTab === item.id ? "is-open" : ""}`} key={item.id}>
              <button className={`nav-link ${activeTab === item.id ? "is-active" : ""}`} type="button" onClick={() => selectTab(item)}>
                {item.icon}
                <span>{item.label}</span>
                {item.subTabs?.length ? <span className="chevron">›</span> : null}
              </button>
              {item.subTabs?.length ? (
                <div className="nav-submenu">
                  {item.subTabs.map((subTab) => (
                    <button
                      className={activeSubTabs[item.id] === subTab.id ? "is-active" : ""}
                      key={subTab.id}
                      type="button"
                      onClick={() => activateAdminTab(item.id, subTab.id)}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <nav className="nav-section bottom" aria-label="Admin settings">
          <div className="nav-label">System</div>
          <button className={`nav-link ${activeTab === "settings" ? "is-active" : ""}`} type="button" onClick={() => activateAdminTab("settings", null)}>
            {icons.settings}
            <span>설정</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="workspace-card">
            <div className="workspace-avatar"><DoripeLogo /></div>
            <div>
              <div className="workspace-name">Doripe Team</div>
              <div className="workspace-role">admin</div>
            </div>
          </div>
        </div>
      </aside>

      <section className="main">
        <header className="d-topbar">
          <div className="crumbs">
            <span>Admin</span>
            <svg className="sep" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
            <span className="current">{activeItem.label}</span>
            {activeSubTabLabel ? (
              <>
                <svg className="sep" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
                <span className="current sub">{activeSubTabLabel}</span>
              </>
            ) : null}
          </div>
          <div className="topbar-actions">
            {message ? (
              <span className="status-pill warning">{message}</span>
            ) : isDataLoading ? (
              <span className="status-pill syncing"><LoadingSpinner label="동기화 중" /></span>
            ) : (
              <span className="status-pill">Live data</span>
            )}
            <button className="icon-btn" type="button" aria-label="로그아웃" onClick={() => void logout()}>
              {icons.logout}
            </button>
          </div>
        </header>

        {activeItem.subTabs?.length ? (
          <nav className="mobile-subnav" aria-label={`${activeItem.label} 하위 메뉴`}>
            {activeItem.subTabs.map((subTab) => (
              <button
                className={activeSubTabs[activeItem.id] === subTab.id ? "is-active" : ""}
                key={subTab.id}
                type="button"
                onClick={() => activateAdminTab(activeItem.id, subTab.id)}
              >
                {subTab.label}
              </button>
            ))}
          </nav>
        ) : null}

        {isDataLoading ? <GlobalLoadingBar label="관리자 데이터 동기화 중" /> : null}

        <section className="content">
          {showInitialDataLoader ? (
            <AdminLoadingSkeleton />
          ) : (
            <>
              {activeTab === "dashboard" ? <DashboardView data={data} stats={stats} /> : null}
              {activeTab === "funnel" && activeSubTab ? <FunnelView onRefreshStats={loadAdminData} stats={stats} subTab={activeSubTab} /> : null}
              {activeTab === "users" && activeSubTab ? <UsersView openDialog={setDialog} stats={stats} subTab={activeSubTab} /> : null}
              {activeTab === "creators" && activeSubTab ? <CreatorsView data={data} openDialog={setDialog} submissions={data.submissions} subTab={activeSubTab} /> : null}
              {activeTab === "stores" && activeSubTab ? <StoresView data={data} openDialog={setDialog} subTab={activeSubTab} /> : null}
              {activeTab === "content" && activeSubTab ? (
                <ContentView
                  closeDialog={() => setDialog(null)}
                  data={data}
                  onDataChange={(updater) => setData(updater)}
                  onRefreshData={loadAdminData}
                  openDialog={setDialog}
                  subTab={activeSubTab}
                />
              ) : null}
              {activeTab === "settings" ? <SettingsView onLogout={() => void logout()} /> : null}
            </>
          )}
        </section>
      </section>

      {dialog ? <Modal dialog={dialog} onClose={() => setDialog(null)} /> : null}
    </main>
  );
}

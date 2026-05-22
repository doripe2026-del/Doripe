import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const articleDir = path.join(publicDir, "blog");
const contentMapPath = path.resolve(__dirname, "../../../docs/content/b2b-blog/content-map.csv");
const siteUrl = "https://doripe.vercel.app";
const lastmod = "2026-05-23";

const manualArticles = [
  {
    id: "B2B005",
    slug: "search-visit-conversion",
    cluster: "신규 손님 유입",
    title: "검색은 되는데 방문이 안 생기는 로컬 공간의 공통 문제",
    keyword: "검색 방문 전환",
    spaces: ["샵", "갤러리", "전시공간"],
    summary: "지도와 검색에 노출되지만 실제 방문으로 이어지지 않는 공간이 먼저 점검할 정보, 장면, 메시지.",
    lead: "검색 결과에 이름은 뜨는데 손님이 오지 않는 공간은 대개 노출 문제가 아니라 결정 정보 문제가 있습니다. 손님은 이미 공간을 봤지만, 아직 오늘 갈 이유까지는 얻지 못한 상태입니다.",
    points: [
      "위치와 영업시간은 보이는데, 어떤 상황에 가면 좋은지 보이지 않는다.",
      "사진은 많지만 첫 방문자가 내부 분위기와 이용 방식을 상상하기 어렵다.",
      "소개 문구가 운영자 입장에서는 맞지만 손님 입장에서는 선택 이유로 번역되지 않는다."
    ],
    checklist: [
      "대표 사진 첫 장을 입구, 내부, 핵심 장면 중 하나로 고정해 첫 방문 불안을 줄입니다.",
      "소개 문구 첫 문장에 업종보다 방문 상황을 씁니다. 예: 조용히 둘러볼 수 있는 주말 전시 공간.",
      "예약, 입장료, 체류 시간, 혼자 방문 가능 여부처럼 망설임을 줄이는 정보를 앞으로 빼둡니다.",
      "검색 결과에서 바로 비교될 수 있는 한 문장 차별점을 정합니다.",
      "인스타, 지도, 웹 소개의 표현을 서로 다르게 두지 말고 같은 방문 이유로 맞춥니다."
    ],
    before: "감각적인 전시와 오브제를 소개합니다.",
    after: "주말 오후 30분 정도 조용히 둘러보고, 작은 오브제까지 살 수 있는 골목 전시 공간입니다.",
    doripe: "Doripe에서는 공간을 업종 카드가 아니라 방문 장면 카드로 봅니다. 검색된 뒤 저장되는 공간은 이름보다 먼저 ‘언제, 누구와, 왜 갈지’가 짧게 보입니다.",
    related: ["B2B016", "B2B068", "B2B014"]
  },
  {
    id: "B2B001",
    slug: "foot-traffic-first-visit",
    cluster: "신규 손님 유입",
    title: "가게 앞 유동인구는 많은데 첫 방문이 적을 때 점검할 것",
    keyword: "신규 손님 유입",
    spaces: ["식당", "카페", "샵"],
    summary: "지나가는 사람은 많지만 들어오는 사람이 적을 때, 간판보다 먼저 온라인 첫인상과 방문 이유를 점검합니다.",
    lead: "유동인구가 많은데 첫 방문이 적다면 문제는 지나가는 사람이 아니라 들어갈 명분입니다. 손님은 문 앞에서 결정하기 전에 이미 지도, 인스타, 리뷰로 이 공간이 자기 상황에 맞는지 확인합니다.",
    points: [
      "밖에서 보이는 정보와 온라인에서 보이는 정보가 서로 다른 인상을 준다.",
      "가격, 메뉴, 분위기 중 무엇을 기대하면 되는지 첫 화면에서 알기 어렵다.",
      "단골에게는 익숙한 표현이 처음 보는 사람에게는 아무 단서가 되지 않는다."
    ],
    checklist: [
      "첫 방문자가 가장 먼저 볼 대표 메뉴, 대표 상품, 대표 좌석을 하나씩 정리합니다.",
      "입구 사진과 내부 사진을 함께 보여줘 들어가기 전의 불안을 줄입니다.",
      "‘혼밥 가능’, ‘선물 포장 가능’, ‘30분 식사 가능’처럼 상황형 단서를 붙입니다.",
      "지도 소개와 인스타 프로필의 첫 문장을 같은 방향으로 맞춥니다.",
      "단골만 아는 별명, 내부 용어, 메뉴 축약어는 첫 화면에서 풀어 씁니다."
    ],
    before: "편안한 분위기의 동네 식당입니다.",
    after: "퇴근길에 혼자 들러도 부담 없는 1인 좌석과 따뜻한 한 끼가 있는 동네 식당입니다.",
    doripe: "Doripe의 공간 카드는 ‘좋다’보다 ‘나에게 맞다’를 먼저 보여주려 합니다. 첫 방문은 설득보다 자기 상황과 맞는 단서를 발견할 때 생깁니다.",
    related: ["B2B004", "B2B006", "B2B009"]
  },
  {
    id: "B2B002",
    slug: "opening-dropoff",
    cluster: "신규 손님 유입",
    title: "오픈 초기 손님이 끊길 때 로컬 공간이 먼저 해야 할 일",
    keyword: "오픈 초기 마케팅",
    spaces: ["식당", "바", "공방"],
    summary: "오픈 직후의 관심을 오래 남기려면 이벤트보다 발견 후 저장까지 이어지는 소개 정보가 먼저 필요합니다.",
    lead: "오픈 초반에는 지인, 동네 호기심, 신규 매장 효과가 한꺼번에 옵니다. 문제는 그 흐름이 끊긴 뒤입니다. 이때 바로 광고부터 켜기보다, 처음 본 사람이 공간을 이해하고 저장할 수 있는 정보가 있는지 확인해야 합니다.",
    points: [
      "오픈 소식은 많았지만 이후에 다시 떠올릴 이유가 정리되지 않았다.",
      "운영 시간, 예약 방식, 추천 이용 상황이 여기저기 흩어져 있다.",
      "초기 방문자가 남긴 사진과 리뷰가 다음 손님에게 충분한 안내가 되지 않는다."
    ],
    checklist: [
      "오픈 인사 글을 고정하지 말고, 지금 방문할 이유가 담긴 소개 글로 바꿉니다.",
      "지도, 인스타, 매장 앞 안내문의 핵심 문장을 하나로 맞춥니다.",
      "처음 오는 손님이 실패하지 않을 대표 선택지를 2개만 앞에 둡니다.",
      "바나 공방처럼 예약/문의가 필요한 공간은 문의 전 확인할 정보를 짧게 적습니다.",
      "첫 방문 후 다시 볼 수 있는 소식 채널을 현장에서 자연스럽게 안내합니다."
    ],
    before: "새로 오픈했습니다. 많이 찾아주세요.",
    after: "예약 없이 들를 수 있는 초반 한 달 메뉴와, 처음 방문한 분이 고르기 쉬운 두 가지 코스를 준비했습니다.",
    doripe: "Doripe 관점에서 오픈 마케팅의 목표는 한 번의 관심이 아니라 저장 가능한 첫인상입니다. 저장된 공간은 다음 주말이나 다음 약속 때 다시 후보가 됩니다.",
    related: ["B2B008", "B2B012", "B2B088"]
  },
  {
    id: "B2B003",
    slug: "weekday-visits",
    cluster: "신규 손님 유입",
    title: "주말에는 붐비는데 평일 손님이 부족한 공간 운영법",
    keyword: "평일 손님 늘리기",
    spaces: ["카페", "서점", "스튜디오"],
    summary: "평일 방문 이유를 만드는 시간대, 좌석, 이용 상황 중심의 콘텐츠 운영법.",
    lead: "주말에 붐비는 공간이 평일에는 비는 이유는 수요가 없어서만은 아닙니다. 손님이 평일에 그 공간을 어떻게 써야 하는지 떠올리지 못하는 경우가 많습니다.",
    points: [
      "주말의 활기만 보여줘 평일의 장점을 손님이 모른다.",
      "작업, 독서, 촬영, 짧은 미팅처럼 평일 이용 상황이 소개되지 않는다.",
      "시간대별로 다른 손님에게 맞는 메시지가 없다."
    ],
    checklist: [
      "월요일 오전, 수요일 저녁처럼 실제로 비는 시간대를 콘텐츠 주제로 잡습니다.",
      "좌석, 조명, 소음, 콘센트, 예약 가능 여부처럼 평일 이용 판단 정보를 보여줍니다.",
      "서점은 새 책 입고, 스튜디오는 촬영 가능 시간, 카페는 조용한 좌석처럼 업종별 이유를 분리합니다.",
      "평일 전용 할인보다 평일에 누릴 수 있는 장면을 먼저 제안합니다.",
      "매주 반복 가능한 고정 코너를 만들어 다시 떠올릴 계기를 만듭니다."
    ],
    before: "평일에도 정상 영업합니다.",
    after: "화요일 오후에는 창가 좌석이 가장 조용합니다. 책 한 권 읽고 가기 좋은 시간대로 비워두고 있어요.",
    doripe: "Doripe는 공간을 시간대와 함께 보여주는 쪽이 저장에 유리하다고 봅니다. 평일 콘텐츠는 빈 시간을 파는 것이 아니라, 그 시간에 어울리는 쓰임을 보여주는 일입니다.",
    related: ["B2B088", "B2B078", "B2B011"]
  },
  {
    id: "B2B004",
    slug: "new-customer-message",
    cluster: "신규 손님 유입",
    title: "동네 단골만 오고 새로운 손님이 안 늘 때 바꿀 메시지",
    keyword: "새로운 손님 유입",
    spaces: ["식당", "카페", "바"],
    summary: "단골에게는 익숙하지만 신규 고객에게는 불친절한 표현을 처음 보는 사람도 이해할 수 있게 바꿉니다.",
    lead: "동네 단골이 있는 공간은 이미 좋은 점을 갖고 있습니다. 다만 그 좋은 점이 내부자 언어로만 설명되면 새로운 손님은 들어가기 전부터 자신이 어울리지 않는다고 느낄 수 있습니다.",
    points: [
      "단골이 아는 메뉴명, 좌석명, 이벤트명이 설명 없이 쓰인다.",
      "처음 온 손님이 어디서 주문하고 얼마나 머물 수 있는지 알기 어렵다.",
      "공간의 매력이 ‘아는 사람만 아는 곳’으로만 남아 있다."
    ],
    checklist: [
      "처음 보는 사람에게 필요한 문장을 단골용 문장보다 앞에 둡니다.",
      "메뉴 이름보다 어떤 맛, 어떤 양, 어떤 상황에 맞는지를 설명합니다.",
      "바라면 첫 잔 추천, 식당이라면 첫 주문 추천, 카페라면 좌석 선택 기준을 적습니다.",
      "단골 이벤트도 신규 손님이 참여할 수 있는지 명확히 씁니다.",
      "온라인 소개에서 ‘우리끼리 아는 말’을 하나씩 줄입니다."
    ],
    before: "늘 하던 그 메뉴 준비했습니다.",
    after: "처음 오신 분이라면 가장 많이 찾는 따뜻한 국물 메뉴와 작은 안주 조합부터 추천합니다.",
    doripe: "Doripe의 소개 방식은 내부자의 애정을 외부자의 이해로 번역하는 데 가깝습니다. 단골의 밀도는 유지하되, 첫 방문자가 들어올 문은 열어둬야 합니다.",
    related: ["B2B001", "B2B017", "B2B078"]
  },
  {
    id: "B2B006",
    slug: "no-discount-first-visit",
    cluster: "신규 손님 유입",
    title: "가격 할인 없이 첫 방문을 만드는 공간 제안법",
    keyword: "첫 방문 마케팅",
    spaces: ["식당", "바", "스튜디오"],
    summary: "할인보다 방문 맥락을 제안해 첫 방문의 이유를 만듭니다.",
    lead: "첫 방문을 만들기 위해 꼭 가격을 낮출 필요는 없습니다. 할인은 빠른 이유가 되지만, 공간의 장점이 아니라 싸다는 사실만 남길 수 있습니다. 작은 공간은 손님이 자기 상황에 맞춰 상상할 수 있는 제안이 더 오래 갑니다.",
    points: [
      "할인 외에 처음 방문할 명분이 보이지 않는다.",
      "공간이 어떤 날, 어떤 사람, 어떤 기분에 맞는지 설명되지 않는다.",
      "가격보다 더 큰 장벽인 예약, 분위기, 동행 적합성이 방치되어 있다."
    ],
    checklist: [
      "데이트 전 식사, 혼자 한 잔, 선물 고르기, 촬영 전 준비처럼 상황을 먼저 씁니다.",
      "대표 가격보다 실패하지 않을 첫 선택지를 앞세웁니다.",
      "예약이 필요한 경우 예약 이유와 추천 시간을 함께 안내합니다.",
      "처음 오는 사람이 과하게 꾸미거나 준비해야 한다고 느끼지 않게 분위기를 설명합니다.",
      "할인 문구 대신 ‘처음이라면 이렇게 이용해보세요’ 문구를 만듭니다."
    ],
    before: "첫 방문 10% 할인.",
    after: "처음 오신다면 40분 정도 여유를 두고, 가장 조용한 바 좌석에서 시그니처 한 잔부터 시작해보세요.",
    doripe: "Doripe가 공간을 소개할 때 중요하게 보는 것은 가격 혜택보다 사용 장면입니다. 장면이 선명하면 손님은 할인 없이도 방문을 후보에 올립니다.",
    related: ["B2B001", "B2B010", "B2B078"]
  },
  {
    id: "B2B007",
    slug: "neighborhood-customers",
    cluster: "신규 손님 유입",
    title: "관광객보다 동네 손님을 먼저 잡아야 하는 공간의 기준",
    keyword: "동네 손님 유입",
    spaces: ["서점", "공방", "로컬 공간"],
    summary: "생활 동선 안에서 다시 떠오르는 조건을 기준으로 동네 손님을 먼저 설계합니다.",
    lead: "관광객을 노리지 말아야 한다는 뜻이 아닙니다. 다만 작은 로컬 공간은 반복해서 떠올려주는 손님이 있을 때 버틸 힘이 생깁니다. 그래서 먼저 생활권 손님이 왜 다시 올지부터 설계해야 합니다.",
    points: [
      "한 번 들른 사람에게 다시 떠올릴 계기가 없다.",
      "동네 손님이 부담 없이 이용할 작은 목적이 보이지 않는다.",
      "관광지식 포토스팟 문구만 있고 생활 동선의 언어가 부족하다."
    ],
    checklist: [
      "동네 손님이 자주 겪는 상황을 고릅니다. 퇴근길, 주말 오전, 아이 등원 후 같은 구체적 장면입니다.",
      "서점은 새 입고와 추천 코너, 공방은 짧은 체험과 수리 상담처럼 반복 이유를 만듭니다.",
      "관광객용 설명과 동네 손님용 설명을 한 문장씩 분리합니다.",
      "지나가다 들를 수 있는 조건과 예약이 필요한 조건을 구분합니다.",
      "동네에서 기억될 이름보다 동네에서 쓸모 있는 상황을 먼저 보여줍니다."
    ],
    before: "여행객에게 인기 있는 감성 공간입니다.",
    after: "주말 오전 산책길에 들러 새로 들어온 책과 작은 생활 소품을 천천히 볼 수 있는 동네 서점입니다.",
    doripe: "Doripe는 공간을 생활 동선 안에서 다시 발견되는 후보로 봅니다. 관광객의 발견도 중요하지만, 동네 손님의 반복 저장이 공간의 문맥을 두껍게 만듭니다.",
    related: ["B2B088", "B2B003", "B2B100"]
  },
  {
    id: "B2B008",
    slug: "popup-retention",
    cluster: "신규 손님 유입",
    title: "팝업이 끝난 뒤 손님을 남기려면 행사 전부터 준비할 것",
    keyword: "팝업 손님 유입",
    spaces: ["팝업", "갤러리", "샵"],
    summary: "짧은 노출을 저장과 재방문 실마리로 바꾸는 팝업 전후 안내 흐름.",
    lead: "팝업은 많은 사람을 한 번에 만날 수 있지만, 끝나면 기억도 빠르게 흩어집니다. 손님을 남기려면 행사 당일의 판매보다 먼저 행사 전, 현장, 종료 후의 저장 흐름을 준비해야 합니다.",
    points: [
      "행사 정보는 있지만 행사 뒤에 어디로 이어지는지 보이지 않는다.",
      "현장에서 본 상품이나 작품을 나중에 다시 찾을 단서가 없다.",
      "방문객을 팔로워로만 남기고 실제 재방문 후보로 만들지 못한다."
    ],
    checklist: [
      "팝업 전 게시물에 장소, 기간, 대표 장면, 저장할 이유를 한 번에 넣습니다.",
      "현장에는 QR, 명함, 작은 카드 중 하나로 다음 접점을 남깁니다.",
      "전시나 샵은 작품명, 상품명, 위치, 다음 판매처를 쉽게 찾게 합니다.",
      "종료 후에는 감사 인사보다 다시 볼 수 있는 방법을 먼저 안내합니다.",
      "팝업 방문자를 위한 다음 방문 장면을 한 가지 제안합니다."
    ],
    before: "이번 주말 팝업에서 만나요.",
    after: "이번 주말 팝업에서 본 오브제는 종료 후 온라인 룩북과 다음 전시 일정으로 다시 확인할 수 있습니다.",
    doripe: "Doripe 관점에서 팝업의 핵심은 순간 노출을 저장 가능한 기억으로 바꾸는 일입니다. 짧은 만남에도 다음 장면이 있으면 손님은 공간을 잊지 않습니다.",
    related: ["B2B011", "B2B068", "B2B088"]
  },
  {
    id: "B2B009",
    slug: "alley-location-info",
    cluster: "신규 손님 유입",
    title: "골목 안쪽 매장이 위치 약점을 줄이는 온라인 정보 구성",
    keyword: "골목 매장 홍보",
    spaces: ["식당", "카페", "공방"],
    summary: "골목 안쪽이라는 약점을 입구 사진, 랜드마크, 도보 동선 정보로 줄입니다.",
    lead: "골목 안쪽 매장은 위치가 약점일 수 있지만, 손님이 길을 상상할 수 있으면 약점이 크게 줄어듭니다. 문제는 멀다는 사실보다 찾아가는 과정이 불안하다는 점입니다.",
    points: [
      "지도 핀은 있지만 실제 입구와 주변 랜드마크가 보이지 않는다.",
      "처음 가는 사람이 밤, 비 오는 날, 혼자 방문할 때의 불안을 해소하지 못한다.",
      "길 안내가 너무 짧아 손님이 도착 직전에 이탈할 수 있다."
    ],
    checklist: [
      "가장 가까운 큰길, 편의점, 지하철 출구 같은 랜드마크를 기준으로 설명합니다.",
      "입구 사진과 간판 사진을 지도 대표 사진 근처에 배치합니다.",
      "도보 1분 전부터 보이는 장면을 짧게 적습니다.",
      "공방처럼 예약 방문이 많은 공간은 도착 전 연락 방법을 명확히 둡니다.",
      "위치 안내를 투덜대는 문구가 아니라 발견의 장면으로 바꿉니다."
    ],
    before: "골목 안쪽에 있습니다.",
    after: "2번 출구 편의점을 지나 첫 번째 골목으로 들어오면, 노란 조명의 작은 간판이 보입니다.",
    doripe: "Doripe는 위치 정보를 단순한 주소가 아니라 첫 방문 경험의 일부로 봅니다. 찾아가는 길이 선명하면 골목 안쪽도 기억에 남는 장면이 됩니다.",
    related: ["B2B016", "B2B001", "B2B068"]
  },
  {
    id: "B2B010",
    slug: "high-ticket-low-traffic",
    cluster: "신규 손님 유입",
    title: "객단가는 좋은데 방문자 수가 적은 공간의 유입 진단법",
    keyword: "매장 방문자 늘리기",
    spaces: ["바", "스튜디오", "전시공간"],
    summary: "가격보다 큰 진입 장벽인 예약 방식, 이용 시간, 분위기 불안, 동행 적합성을 점검합니다.",
    lead: "객단가가 높은 공간은 손님 한 명의 만족도가 높아도 방문 수가 적으면 불안정합니다. 이때 무작정 더 넓은 홍보를 하기보다, 처음 보는 사람이 들어오기 전에 느끼는 장벽을 확인해야 합니다.",
    points: [
      "가격보다 예약 방식이나 이용 규칙이 더 큰 장벽일 수 있다.",
      "혼자 가도 되는지, 얼마나 머무는지, 어떤 복장이 어울리는지 손님이 모른다.",
      "고급스럽다는 인상이 편안함보다 먼저 전달된다."
    ],
    checklist: [
      "처음 방문자를 위한 추천 시간, 추천 좌석, 추천 이용 방식을 적습니다.",
      "바는 첫 잔 추천, 스튜디오는 준비물, 전시공간은 관람 시간을 안내합니다.",
      "예약이 필수라면 이유와 가장 쉬운 예약 경로를 함께 보여줍니다.",
      "가격표를 숨기기보다 선택의 기준을 설명합니다.",
      "고급스러움만 강조하지 말고 처음 와도 어색하지 않은 장면을 보여줍니다."
    ],
    before: "프라이빗한 분위기의 공간입니다.",
    after: "처음 방문한다면 평일 저녁 7시 이전 바 좌석에서 조용히 한 잔으로 시작하기 좋습니다.",
    doripe: "Doripe는 높은 객단가를 직접 말하기보다 그 공간이 어울리는 순간을 보여주는 편이 낫다고 봅니다. 손님이 자기 상황을 대입할 수 있으면 진입 장벽은 낮아집니다.",
    related: ["B2B006", "B2B068", "B2B100"]
  },
  {
    id: "B2B011",
    slug: "instagram-content-ideas",
    cluster: "인스타/숏폼 운영",
    title: "인스타에 올려도 반응이 없을 때 로컬 공간이 바꿀 소재",
    keyword: "인스타 콘텐츠 소재",
    spaces: ["카페", "샵", "공방"],
    summary: "예쁜 사진 반복에서 벗어나 손님이 저장하고 공유할 수 있는 장면 중심 소재를 정리합니다.",
    lead: "인스타 반응이 낮다고 해서 사진 실력이 부족한 것은 아닙니다. 로컬 공간의 콘텐츠는 예쁜 결과물보다 손님이 자기 생활에 넣어볼 수 있는 장면을 보여줄 때 더 쓸모가 생깁니다.",
    points: [
      "메뉴나 상품 사진만 반복돼 방문 상황이 보이지 않는다.",
      "손님이 저장할 정보가 없는 감성 문구만 남는다.",
      "공방이나 샵의 과정, 쓰임, 선물 맥락이 빠져 있다."
    ],
    checklist: [
      "상품 사진 1장마다 사용 장면 1장을 함께 준비합니다.",
      "카페는 좌석과 시간대, 샵은 선물 상황, 공방은 만드는 과정을 소재로 둡니다.",
      "한 게시물에 너무 많은 메시지를 넣지 말고 하나의 방문 이유만 씁니다.",
      "릴스는 화려한 편집보다 손님이 궁금해하는 순서를 따라갑니다.",
      "반응이 낮았던 게시물을 지우기보다 소재 유형별로 다시 묶어봅니다."
    ],
    before: "오늘의 신상품입니다.",
    after: "퇴근길에 바로 선물하기 좋은 작은 컵 세트입니다. 포장까지 10분 정도 걸립니다.",
    doripe: "Doripe가 보는 좋은 소재는 공간의 예쁨을 증명하는 것이 아니라 손님의 다음 행동을 쉽게 만드는 단서입니다. 저장할 이유가 있어야 게시물이 방문 후보가 됩니다.",
    related: ["B2B014", "B2B012", "B2B078"]
  },
  {
    id: "B2B012",
    slug: "instagram-to-visit",
    cluster: "인스타/숏폼 운영",
    title: "팔로워는 있는데 방문으로 이어지지 않는 계정의 문제",
    keyword: "인스타 방문 전환",
    spaces: ["식당", "바", "서점"],
    summary: "좋아요와 팔로워가 방문 의사로 바뀌지 않는 이유를 프로필, 고정 게시물, 방문 장면에서 찾습니다.",
    lead: "팔로워 수가 있어도 방문이 늘지 않는 계정은 흔합니다. 팔로워는 관심을 뜻할 수 있지만, 방문은 다른 결정입니다. 계정 안에서 손님이 언제, 어떻게, 왜 가야 하는지 확인할 수 있어야 합니다.",
    points: [
      "프로필이 예쁘지만 위치, 예약, 대표 이용 상황이 빠져 있다.",
      "고정 게시물이 브랜드 소개에 머물고 첫 방문 안내가 없다.",
      "식당, 바, 서점마다 필요한 방문 전환 정보가 다른데 모두 같은 방식으로 말한다."
    ],
    checklist: [
      "프로필 첫 줄에 업종보다 방문 상황을 씁니다.",
      "고정 게시물 3개를 처음 방문 안내, 대표 메뉴/상품, 예약/위치로 나눕니다.",
      "바는 첫 주문, 식당은 대표 조합, 서점은 추천 코너처럼 첫 선택지를 둡니다.",
      "하이라이트에는 영업시간보다 자주 묻는 방문 질문을 먼저 정리합니다.",
      "게시물 말미의 CTA를 ‘오세요’가 아니라 ‘저장해두세요’, ‘예약 전 확인하세요’처럼 구체화합니다."
    ],
    before: "좋은 공간을 만들고 있습니다.",
    after: "처음 오신다면 고정 게시물의 첫 주문 가이드와 위치 안내를 먼저 확인해주세요.",
    doripe: "Doripe는 SNS 계정을 작은 방문 안내서로 봅니다. 팔로워가 많은 계정보다, 처음 보는 사람이 망설이지 않게 해주는 계정이 방문에 가깝습니다.",
    related: ["B2B011", "B2B068", "B2B016"]
  },
  {
    id: "B2B014",
    slug: "instagram-saveable-photos",
    cluster: "인스타/숏폼 운영",
    title: "예쁜 사진만 올리는데 저장이 안 되는 이유",
    keyword: "인스타 저장 늘리기",
    spaces: ["갤러리", "전시공간", "샵"],
    summary: "저장되는 사진에는 분위기뿐 아니라 다시 찾아볼 정보 단서가 있어야 합니다.",
    lead: "예쁜 사진은 멈춰 보게 만들 수 있습니다. 하지만 저장은 다릅니다. 손님은 나중에 다시 필요할 것 같은 정보, 함께 가고 싶은 이유, 방문할 장면이 있을 때 저장합니다.",
    points: [
      "사진은 좋지만 위치, 기간, 이용 상황이 함께 기억되지 않는다.",
      "전시공간이나 샵의 경우 작품과 상품의 맥락이 빠져 있다.",
      "분위기가 비슷한 사진이 반복돼 저장할 차이가 없다."
    ],
    checklist: [
      "사진마다 손님이 다시 확인할 정보 하나를 붙입니다.",
      "전시 기간, 입장 방식, 추천 관람 시간처럼 저장 이유를 명확히 둡니다.",
      "샵은 상품 단독컷보다 쓰임, 크기감, 선물 상황을 함께 보여줍니다.",
      "공간 사진은 좌석, 동선, 조도처럼 방문 전 판단 단서를 담습니다.",
      "캡션 첫 문장을 감탄보다 정보로 시작해도 충분히 분위기는 남습니다."
    ],
    before: "오늘의 무드.",
    after: "이번 전시는 2층 작은 방까지 이어집니다. 조용히 보려면 평일 오후 3시 이후가 좋습니다.",
    doripe: "Doripe의 공간 카드는 저장을 전제로 합니다. 저장되는 사진은 예쁜 장면과 다시 찾아볼 이유가 같이 있을 때 강합니다.",
    related: ["B2B011", "B2B068", "B2B100"]
  },
  {
    id: "B2B016",
    slug: "naver-place-conversion",
    cluster: "네이버 플레이스/지도",
    title: "네이버 플레이스 조회수는 있는데 예약과 방문이 적을 때",
    keyword: "네이버 플레이스 전환",
    spaces: ["식당", "스튜디오", "공방"],
    summary: "조회수 다음 단계에서 손님이 멈추는 지점을 사진 순서, 소개 문구, 예약 동선으로 나눠 봅니다.",
    lead: "네이버 플레이스 조회수가 있다는 것은 발견은 되고 있다는 뜻입니다. 그런데 예약과 방문이 적다면 손님은 상세 페이지 안에서 멈추고 있을 가능성이 큽니다.",
    points: [
      "대표 사진이 예쁘지만 첫 방문 판단에 필요한 정보가 아니다.",
      "소개 문구가 길거나 추상적이라 핵심 차이가 바로 보이지 않는다.",
      "예약, 문의, 주차, 준비물 같은 다음 행동 정보가 늦게 나온다."
    ],
    checklist: [
      "대표 사진 순서를 입구, 내부, 대표 메뉴/작업물, 이용 장면 순으로 점검합니다.",
      "소개 문구 첫 문장에 누구에게 맞는 공간인지 씁니다.",
      "식당은 대기/예약, 스튜디오는 준비물, 공방은 소요 시간을 앞쪽에 둡니다.",
      "메뉴나 프로그램명만 나열하지 말고 처음 선택할 기준을 붙입니다.",
      "전화, 예약, 문의 중 운영자가 실제로 잘 응답할 수 있는 경로를 우선합니다."
    ],
    before: "다양한 프로그램을 운영합니다.",
    after: "처음 방문하는 분은 90분 기초 클래스를 추천합니다. 준비물은 없고, 예약 후 방문하면 됩니다.",
    doripe: "Doripe는 지도 페이지를 검색 결과의 끝이 아니라 방문 결정의 시작으로 봅니다. 조회 이후 손님이 묻는 질문에 먼저 답하면 전환 가능성이 높아집니다.",
    related: ["B2B005", "B2B017", "B2B068"]
  },
  {
    id: "B2B017",
    slug: "map-differentiation",
    cluster: "네이버 플레이스/지도",
    title: "지도에서 가게가 비슷해 보일 때 차별점을 보여주는 방법",
    keyword: "네이버 지도 마케팅",
    spaces: ["카페", "바", "샵"],
    summary: "같은 업종 비교 화면에서 한 문장 차별점과 첫 사진이 해야 할 일을 정리합니다.",
    lead: "지도에서 손님은 공간을 하나씩 깊게 읽지 않습니다. 비슷한 카페, 비슷한 바, 비슷한 샵을 빠르게 넘겨보며 자기에게 맞는 단서를 찾습니다. 차별점은 멋진 표현보다 비교 화면에서 바로 보이는 구체성입니다.",
    points: [
      "업종명과 분위기 표현만으로는 주변 공간과 구분되지 않는다.",
      "첫 사진이 예쁘지만 어떤 차이가 있는지 말하지 않는다.",
      "지도 소개가 브랜드 문장에 가까워 손님의 선택 기준이 되지 않는다."
    ],
    checklist: [
      "첫 문장에 메뉴, 좌석, 큐레이션, 운영 방식 중 하나의 차이를 넣습니다.",
      "첫 사진은 가장 차이가 잘 보이는 장면으로 둡니다.",
      "카페는 좌석/소음, 바는 첫 잔/음악, 샵은 큐레이션 기준을 설명합니다.",
      "주변 공간과 비교했을 때 같은 말은 과감히 줄입니다.",
      "차별점을 길게 설명하지 말고 지도에서 읽히는 한 문장으로 압축합니다."
    ],
    before: "분위기 좋은 카페입니다.",
    after: "혼자 앉기 좋은 1인 창가석과 직접 고른 생활 소품을 함께 볼 수 있는 작은 카페입니다.",
    doripe: "Doripe의 카드식 소개는 비교 피로를 줄이는 방식입니다. 손님이 여러 공간을 넘겨볼 때도 ‘이 공간은 이런 상황에 맞다’가 남아야 합니다.",
    related: ["B2B016", "B2B078", "B2B001"]
  },
  {
    id: "B2B068",
    slug: "saves-to-visits",
    cluster: "리뷰/저장/방문 전환",
    title: "저장은 많은데 방문이 적을 때 고객이 망설이는 지점",
    keyword: "저장 방문 전환",
    spaces: ["식당", "카페", "갤러리"],
    summary: "저장 이후에도 방문이 일어나지 않을 때 부족한 정보와 망설임을 줄이는 운영자 메시지.",
    lead: "저장은 방문 직전 행동처럼 보이지만 실제로는 후보 등록에 가깝습니다. 손님은 저장한 뒤에도 동행, 시간, 예약, 분위기, 비용을 다시 확인합니다.",
    points: [
      "저장할 만큼 매력은 있지만 방문 전 확인 정보가 부족하다.",
      "혼자 가도 되는지, 아이와 가도 되는지, 예약이 필요한지 알기 어렵다.",
      "손님이 다시 열어봤을 때 바로 결정할 문장이 없다."
    ],
    checklist: [
      "저장한 사람이 다시 확인할 정보를 캡션과 지도 소개에 반복해서 둡니다.",
      "동행 적합성, 추천 시간, 예약 필요 여부를 짧게 씁니다.",
      "식당은 대기와 대표 메뉴, 카페는 좌석과 소음, 갤러리는 관람 시간을 안내합니다.",
      "리뷰 답변에서도 다음 방문자가 궁금해할 정보를 자연스럽게 보강합니다.",
      "‘저장해두세요’ 다음에 언제 꺼내보면 좋은지까지 제안합니다."
    ],
    before: "저장하고 나중에 방문해주세요.",
    after: "비 오는 날에도 실내 좌석이 넉넉합니다. 주말에는 2시 이후가 비교적 여유로워요.",
    doripe: "Doripe에서는 저장을 끝이 아니라 다음 방문 후보에 들어가는 순간으로 봅니다. 저장 이후의 망설임을 줄이는 정보가 있어야 실제 방문에 가까워집니다.",
    related: ["B2B005", "B2B012", "B2B088"]
  },
  {
    id: "B2B078",
    slug: "brand-language",
    cluster: "공간 브랜딩/분위기",
    title: "공간 분위기는 좋은데 설명이 어려울 때 쓰는 언어 정리법",
    keyword: "공간 브랜딩 문구",
    spaces: ["카페", "갤러리", "서점"],
    summary: "감성, 조용함, 아늑함 같은 단어를 손님이 실제로 선택할 수 있는 방문 상황으로 바꾸는 방법.",
    lead: "분위기가 좋은 공간일수록 설명이 어려울 때가 많습니다. 하지만 ‘감성적인’, ‘따뜻한’, ‘힐링되는’ 같은 말만 반복하면 손님은 그 공간이 자기에게 맞는지 판단하기 어렵습니다.",
    points: [
      "분위기 단어가 많지만 방문 상황으로 연결되지 않는다.",
      "카페, 갤러리, 서점이 모두 비슷한 문구를 쓰게 된다.",
      "운영자가 느끼는 아름다움이 손님의 선택 기준으로 번역되지 않는다."
    ],
    checklist: [
      "분위기 단어 하나를 고른 뒤 ‘언제 좋은지’로 바꿔 씁니다.",
      "조용함은 소음 수준, 좌석 간격, 추천 시간 같은 정보로 풀어냅니다.",
      "갤러리는 관람 속도, 서점은 머무는 방식, 카페는 좌석 경험을 다르게 씁니다.",
      "형용사 세 개보다 방문 장면 한 문장이 낫습니다.",
      "소개 문구를 쓴 뒤 손님이 어떤 행동을 떠올릴 수 있는지 확인합니다."
    ],
    before: "아늑하고 감성적인 공간입니다.",
    after: "비 오는 오후에 혼자 앉아 책 한 권 읽기 좋은 낮은 조도와 작은 좌석이 있는 공간입니다.",
    doripe: "Doripe는 분위기를 이미지가 아니라 선택 가능한 언어로 바꾸려 합니다. 분위기가 구체적인 장면이 될 때 손님은 저장할 이유를 얻습니다.",
    related: ["B2B017", "B2B100", "B2B011"]
  },
  {
    id: "B2B088",
    slug: "repeat-visit-reason",
    cluster: "재방문/단골/커뮤니티",
    title: "한 번 온 손님이 다시 올 이유를 만들지 못하는 공간의 문제",
    keyword: "재방문 유도",
    spaces: ["식당", "카페", "서점"],
    summary: "첫 방문 후 다시 떠올릴 계기를 계절 메뉴, 모임, 책/전시 교체, 단골 루틴으로 만듭니다.",
    lead: "한 번 만족한 손님이 꼭 다시 오지는 않습니다. 다시 오려면 만족보다 더 구체적인 계기가 필요합니다. 다음에 올 이유가 보이지 않으면 좋은 경험도 추억으로 끝납니다.",
    points: [
      "첫 방문 후 이어지는 소식이나 변화가 보이지 않는다.",
      "단골 혜택만 말하고 다시 와야 할 장면을 만들지 못한다.",
      "식당, 카페, 서점의 반복 이유가 모두 같은 말로 표현된다."
    ],
    checklist: [
      "계절 메뉴, 새로운 책, 전시 교체, 작은 모임처럼 다시 올 명분을 정합니다.",
      "첫 방문 손님에게 다음에 보면 좋은 것을 현장에서 한 가지 알려줍니다.",
      "쿠폰보다 기억하기 쉬운 루틴을 만듭니다.",
      "인스타에는 새 소식만 올리지 말고 다시 올 상황을 함께 씁니다.",
      "재방문 메시지를 ‘또 오세요’가 아니라 ‘다음에는 이것을 보세요’로 바꿉니다."
    ],
    before: "다음에 또 방문해주세요.",
    after: "다음 주부터는 봄 메뉴와 새로 들어온 독립출판 코너가 함께 열립니다.",
    doripe: "Doripe는 재방문을 혜택보다 기억의 문제로 봅니다. 손님이 저장한 공간을 다시 열어볼 이유가 생기면 방문은 자연스럽게 가까워집니다.",
    related: ["B2B003", "B2B007", "B2B068"]
  },
  {
    id: "B2B096",
    slug: "saved-space-report",
    cluster: "Doripe 리포트/케이스",
    title: "저장되는 공간과 스쳐 지나가는 공간은 무엇이 다른가",
    keyword: "Doripe 공간 저장 리포트",
    spaces: ["식당", "카페", "로컬 공간"],
    summary: "Doripe가 공간 카드를 만들며 관찰한, 저장할 이유를 만드는 사진, 문구, 상황의 차이.",
    lead: "이 글은 정량 리포트가 아니라 Doripe가 공간을 카드로 정리하며 관찰한 패턴입니다. 저장되는 공간은 대체로 예쁘기만 한 공간이 아니라, 나중에 다시 꺼내볼 이유가 있는 공간입니다.",
    points: [
      "사진이 공간의 분위기뿐 아니라 이용 장면을 보여준다.",
      "문구가 업종 소개보다 방문 상황을 먼저 말한다.",
      "손님이 다시 볼 정보가 카드 안에 남아 있다."
    ],
    checklist: [
      "대표 사진 한 장에 공간의 핵심 장면이 담겨 있는지 봅니다.",
      "첫 문장이 ‘무엇을 파는지’보다 ‘어떤 때 가면 좋은지’를 말하는지 확인합니다.",
      "저장 후 다시 확인할 정보가 흩어져 있지 않은지 점검합니다.",
      "식당, 카페, 샵, 전시공간 모두 같은 형용사로 소개되지 않게 합니다.",
      "운영자가 하고 싶은 말보다 손님이 다시 볼 말을 앞에 둡니다."
    ],
    before: "좋은 공간을 소개합니다.",
    after: "퇴근 후 조용히 식사할 곳, 주말에 새 전시를 볼 곳처럼 다시 꺼내볼 장면을 남깁니다.",
    doripe: "Doripe의 기본 가정은 간단합니다. 사람은 장소를 업종보다 장면으로 기억합니다. 그래서 저장되는 공간에는 사진, 문구, 상황 단서가 함께 있어야 합니다.",
    related: ["B2B005", "B2B068", "B2B100"]
  },
  {
    id: "B2B100",
    slug: "atmosphere-case",
    cluster: "Doripe 리포트/케이스",
    title: "운영자가 직접 말하지 않아도 분위기가 전해지는 공간 사례",
    keyword: "Doripe 공간 사례",
    spaces: ["서점", "카페", "공방"],
    summary: "가상의 공간 카드 예시로 사진 순서와 짧은 문장 조합이 분위기를 전달하는 방식을 보여줍니다.",
    lead: "이 글의 사례는 실제 매장 성과를 주장하는 고객 사례가 아니라, Doripe가 공간 카드를 만들 때 사용하는 가상 예시입니다. 핵심은 운영자가 많은 설명을 하지 않아도 손님이 분위기를 상상하게 만드는 구성입니다.",
    points: [
      "첫 사진이 공간의 온도와 사용 방식을 동시에 보여준다.",
      "짧은 문장이 분위기 단어보다 방문 상황을 말한다.",
      "사진 순서가 입구, 머무는 장면, 세부 요소로 이어진다."
    ],
    checklist: [
      "첫 장에는 가장 예쁜 컷보다 가장 이해가 빠른 컷을 둡니다.",
      "두 번째 장에는 손님이 머무는 방식을 보여줍니다.",
      "세 번째 장에는 메뉴, 책, 도구처럼 공간의 취향을 보여주는 디테일을 둡니다.",
      "문구는 ‘감성적’ 대신 ‘혼자 와도 어색하지 않은’처럼 상황형으로 씁니다.",
      "서점, 카페, 공방의 카드가 서로 다른 쓰임을 갖도록 구성합니다."
    ],
    before: "분위기가 좋은 서점 겸 카페입니다.",
    after: "낮은 책장 사이 작은 테이블에서 혼자 읽고, 마음에 드는 문장을 엽서처럼 골라갈 수 있는 공간입니다.",
    doripe: "Doripe의 공간 카드는 운영자의 설명을 줄이고 손님의 상상을 늘리는 방향을 지향합니다. 좋은 소개는 많은 말을 하지 않아도 ‘나에게 맞을지’를 떠올리게 합니다.",
    related: ["B2B078", "B2B096", "B2B014"]
  }
];

const manualById = new Map(manualArticles.map((article) => [article.id, article]));

function parseCsv(content) {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

const clusterGuides = {
  "신규 손님 유입": {
    countLabel: "20 articles",
    topicCopy: "첫 방문, 평일 유입, 골목 매장, 오픈 초기 흐름.",
    points: [
      "처음 보는 손님이 방문 상황을 바로 떠올리기 어렵다.",
      "온라인 소개와 실제 공간 경험이 같은 메시지로 이어지지 않는다.",
      "유입을 늘리려는 말은 많지만 첫 방문 장벽을 줄이는 정보가 부족하다."
    ],
    checklist: [
      "첫 화면에 업종보다 방문 상황을 먼저 적습니다.",
      "대표 사진을 입구, 내부, 핵심 이용 장면 순서로 점검합니다.",
      "처음 온 사람이 실패하지 않을 선택지를 1개 이상 앞에 둡니다.",
      "지도, 인스타, 현장 안내의 핵심 문장을 같은 방향으로 맞춥니다.",
      "할인보다 방문해야 할 맥락을 한 문장으로 정리합니다."
    ]
  },
  "인스타/숏폼 운영": {
    countLabel: "15 articles",
    topicCopy: "반응보다 방문으로 이어지는 소재와 반복 포맷.",
    points: [
      "예쁜 장면은 있지만 저장하거나 방문할 이유가 같이 보이지 않는다.",
      "콘텐츠가 계정 안에서 끝나고 지도, 예약, 현장 방문으로 이어지지 않는다.",
      "좋아요를 받는 소재와 실제 방문을 돕는 소재가 섞여 있다."
    ],
    checklist: [
      "게시물마다 손님이 저장할 정보 하나를 붙입니다.",
      "프로필, 고정 게시물, 하이라이트에 첫 방문 안내를 나눠 둡니다.",
      "상품이나 메뉴 단독컷보다 이용 장면을 함께 보여줍니다.",
      "캡션 마지막에는 다음 행동을 구체적으로 적습니다.",
      "반응이 낮은 게시물은 소재, 정보, 방문 장면 중 무엇이 빠졌는지 나눠 봅니다."
    ]
  },
  "네이버 플레이스/지도": {
    countLabel: "15 articles",
    topicCopy: "조회 이후 예약, 전화, 저장으로 이어지는 정보 구성.",
    points: [
      "조회는 생기지만 손님이 다음 행동을 하기 전에 멈춘다.",
      "대표 사진, 소개 문구, 메뉴 정보가 선택 기준으로 정리되어 있지 않다.",
      "예약, 문의, 찾아오는 길처럼 결정 직전 정보가 뒤에 숨어 있다."
    ],
    checklist: [
      "대표 사진 첫 장이 첫 방문 판단에 필요한 장면인지 봅니다.",
      "소개 문구 첫 줄에 누구에게 맞는 공간인지 씁니다.",
      "예약, 대기, 주차, 준비물, 문의 경로를 앞쪽으로 당깁니다.",
      "메뉴나 프로그램명에는 처음 선택할 기준을 붙입니다.",
      "지도에서 주변 공간과 비교될 때 남을 한 문장을 정합니다."
    ]
  },
  "사진/콘텐츠 소재": {
    countLabel: "15 articles",
    topicCopy: "메뉴 사진을 넘어 방문 장면을 남기는 방법.",
    points: [
      "사진은 많지만 손님이 어떤 경험을 하게 되는지 보이지 않는다.",
      "공간의 디테일이 방문 판단에 필요한 정보로 연결되지 않는다.",
      "운영자가 좋아하는 컷과 손님이 저장하는 컷의 기준이 다르다."
    ],
    checklist: [
      "사진 한 장마다 손님이 알게 되는 정보를 하나씩 정합니다.",
      "전체 분위기, 이용 장면, 디테일 컷을 섞어 배치합니다.",
      "가격이나 메뉴보다 먼저 필요한 크기감, 좌석감, 동선을 보여줍니다.",
      "사진 설명은 감탄보다 방문 상황에 가깝게 씁니다.",
      "반복되는 예쁜 컷은 줄이고 새로 판단할 수 있는 컷을 넣습니다."
    ]
  },
  "리뷰/저장/방문 전환": {
    countLabel: "10 articles",
    topicCopy: "저장된 공간이 실제 방문 후보가 되는 조건.",
    points: [
      "저장과 리뷰가 방문 직전의 결정 정보로 이어지지 않는다.",
      "손님이 다시 확인할 정보가 흩어져 있어 후보에서 밀린다.",
      "좋은 반응은 있지만 망설임을 줄이는 운영자 답변이 부족하다."
    ],
    checklist: [
      "저장한 사람이 다시 볼 정보를 소개 문구와 캡션에 반복합니다.",
      "동행, 시간, 예약 필요 여부처럼 방문 직전 질문에 답합니다.",
      "리뷰 답변에는 다음 손님이 알아야 할 정보를 자연스럽게 보강합니다.",
      "저장 요청 뒤에는 언제 꺼내보면 좋은지까지 제안합니다.",
      "후보로 남은 손님이 망설일 이유를 하나씩 지웁니다."
    ]
  },
  "공간 브랜딩/분위기": {
    countLabel: "10 articles",
    topicCopy: "좋은 분위기를 검색 가능한 언어로 바꾸는 법.",
    points: [
      "분위기 단어는 많지만 손님이 선택할 수 있는 상황으로 번역되지 않는다.",
      "비슷한 형용사가 반복돼 공간만의 차이가 흐려진다.",
      "운영자가 느끼는 감각이 외부 손님에게는 정보가 되지 않는다."
    ],
    checklist: [
      "분위기 단어 하나를 고른 뒤 언제 좋은지로 바꿔 씁니다.",
      "좌석, 조도, 소음, 동선처럼 느낄 수 있는 요소를 함께 적습니다.",
      "업종별로 다른 쓰임을 살려 문구를 나눕니다.",
      "형용사 세 개보다 방문 장면 한 문장을 우선합니다.",
      "소개 문구를 읽은 손님이 어떤 행동을 떠올리는지 확인합니다."
    ]
  },
  "재방문/단골/커뮤니티": {
    countLabel: "10 articles",
    topicCopy: "한 번 온 손님이 다시 떠올릴 이유 만들기.",
    points: [
      "좋은 경험은 있었지만 다시 올 계기가 남지 않았다.",
      "혜택 안내는 있지만 기억할 만한 루틴이나 변화가 보이지 않는다.",
      "단골과 신규 손님이 함께 이해할 수 있는 다음 장면이 부족하다."
    ],
    checklist: [
      "계절 메뉴, 새 입고, 전시 교체, 모임처럼 다시 올 이유를 정합니다.",
      "첫 방문 손님에게 다음에 볼 것을 현장에서 하나 안내합니다.",
      "쿠폰보다 기억하기 쉬운 반복 루틴을 만듭니다.",
      "새 소식만 올리지 말고 다시 올 상황을 함께 씁니다.",
      "재방문 메시지를 또 오라는 말에서 다음에는 이것을 보라는 말로 바꿉니다."
    ]
  },
  "Doripe 리포트/케이스": {
    countLabel: "5 articles",
    topicCopy: "저장되는 공간과 스쳐 지나가는 공간의 차이.",
    points: [
      "공간의 매력이 업종명이나 형용사만으로 정리되어 있다.",
      "사진, 문구, 상황 단서가 따로 움직여 저장할 이유가 약해진다.",
      "실제 수치 없이 데이터처럼 보이는 표현을 쓰기 쉽다."
    ],
    checklist: [
      "정량 수치가 없을 때는 관찰이라고 명확히 씁니다.",
      "사진, 문구, 상황 단서가 같은 방문 장면을 말하는지 봅니다.",
      "실제 고객 사례처럼 꾸미지 말고 예시는 예시라고 밝힙니다.",
      "운영자 관점보다 손님이 저장할 이유를 앞에 둡니다.",
      "공간 카드를 만들 때 남는 한 문장을 기준으로 정리합니다."
    ]
  }
};

const defaultGuide = clusterGuides["신규 손님 유입"];

function splitPipes(value) {
  return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
}

function makeSummary(row) {
  const spaces = splitPipes(row.target_space_types).join(", ");
  return `${spaces} 운영자가 ${row.primary_keyword} 문제를 점검할 때 먼저 볼 정보, 장면, 메시지를 정리합니다.`;
}

function makeLead(row) {
  const spaces = splitPipes(row.target_space_types).join(", ");
  return `${row.title}라는 고민은 ${spaces}처럼 작은 로컬 공간에서 자주 생깁니다. 문제를 크게 잡으면 광고나 할인으로만 풀게 되지만, 실제로는 손님이 방문 전에 확인하는 정보와 장면을 정리하는 것부터 시작할 수 있습니다.`;
}

function makeBefore(row) {
  const spaces = splitPipes(row.target_space_types);
  const space = spaces[0] ?? "공간";
  return `${space}을 더 많은 분께 알리고 싶습니다.`;
}

function makeAfter(row) {
  const spaces = splitPipes(row.target_space_types);
  const space = spaces[0] ?? "공간";
  return `${space}을 처음 보는 손님도 ${row.primary_keyword} 상황에서 바로 떠올릴 수 있도록, 방문 장면과 확인 정보를 함께 보여줍니다.`;
}

function makeDoripe(row) {
  const angle = row.doripe_angle.replaceAll("최신성", "정보 갱신");
  return `Doripe는 이 주제를 ${angle} 관점에서 봅니다. 공간을 업종으로만 설명하기보다 손님이 저장하고 다시 꺼내볼 장면으로 바꾸는 일이 핵심입니다.`;
}

function normalizeArticle(row) {
  const manual = manualById.get(row.id) ?? {};
  const guide = clusterGuides[row.cluster] ?? defaultGuide;
  return {
    id: row.id,
    priority: row.priority,
    slug: manual.slug ?? row.id.toLowerCase(),
    cluster: row.cluster,
    title: row.title,
    keyword: row.primary_keyword,
    spaces: splitPipes(row.target_space_types),
    secondaryKeywords: splitPipes(row.secondary_keywords),
    searchIntent: row.search_intent,
    doripeAngle: row.doripe_angle,
    internalLinkClusters: splitPipes(row.internal_links),
    summary: manual.summary ?? makeSummary(row),
    lead: manual.lead ?? makeLead(row),
    points: manual.points ?? guide.points,
    checklist: manual.checklist ?? guide.checklist,
    before: manual.before ?? makeBefore(row),
    after: manual.after ?? makeAfter(row),
    doripe: manual.doripe ?? makeDoripe(row),
    related: manual.related ?? []
  };
}

function attachRelated(article, allArticles) {
  if (article.related.length > 0) return article;
  const related = [];
  for (const cluster of article.internalLinkClusters) {
    const found = allArticles.find((candidate) => candidate.id !== article.id && candidate.cluster === cluster);
    if (found && !related.includes(found.id)) related.push(found.id);
  }
  for (const candidate of allArticles) {
    if (related.length >= 3) break;
    if (candidate.id !== article.id && candidate.cluster === article.cluster && !related.includes(candidate.id)) {
      related.push(candidate.id);
    }
  }
  for (const candidate of allArticles) {
    if (related.length >= 3) break;
    if (candidate.id !== article.id && !related.includes(candidate.id)) related.push(candidate.id);
  }
  return { ...article, related: related.slice(0, 3) };
}

const rows = parseCsv(await readFile(contentMapPath, "utf8"));
const normalizedArticles = rows.map(normalizeArticle);
const articles = normalizedArticles.map((article) => attachRelated(article, normalizedArticles));
const byId = new Map(articles.map((article) => [article.id, article]));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const breakableKorean = (value) => escapeHtml(value).replace(/([가-힣]{2})/g, "$1<wbr>");

const articleUrl = (article) => `/blog/${article.slug}`;

const renderTags = (article) =>
  [article.keyword, ...article.spaces].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

const commonStyles = `
  :root {
    --paper: #fbfaf6;
    --paper-2: #f2f0e8;
    --ink: #171714;
    --muted: #6d6a61;
    --line: #ded9ca;
    --line-strong: #c8c0ad;
    --green: #0c8f53;
    --green-soft: #e2f4e9;
    --blue-soft: #e8f0f8;
    --yellow-soft: #fbf0c6;
    --rose-soft: #f6e6df;
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: "Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
    letter-spacing: 0;
  }
  a { color: inherit; text-decoration: none; }
  .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgba(251, 250, 246, 0.92);
    border-bottom: 1px solid rgba(222, 217, 202, 0.8);
    backdrop-filter: blur(18px);
  }
  .nav {
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .brand {
    font-size: 22px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: 0;
  }
  .brand span { color: var(--green); }
  .navlinks {
    display: flex;
    align-items: center;
    gap: 22px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
  }
  .navlinks a[aria-current="page"] { color: var(--ink); }
  .nav-cta {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 0 16px;
    border: 1px solid var(--ink);
    border-radius: 8px;
    color: var(--ink);
    background: #fff;
  }
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 850;
    border: 1px solid var(--ink);
    background: #fff;
  }
  .button.primary { background: var(--ink); color: #fff; }
  .tag {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 9px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid var(--line);
    color: #565249;
    font-size: 12px;
    font-weight: 750;
  }
  footer { padding: 34px 0 56px; }
  .footer-row {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    color: var(--muted);
    font-size: 13px;
  }
  .footer-links { display: flex; gap: 14px; flex-wrap: wrap; }
  @media (max-width: 640px) {
    .shell {
      width: auto;
      margin-left: 14px;
      margin-right: 14px;
    }
    .nav {
      height: auto;
      padding: 16px 0;
      align-items: flex-start;
    }
    .navlinks {
      gap: 12px;
      font-size: 13px;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-width: 250px;
    }
    .navlinks a[href="/business"],
    .nav-cta { display: none; }
    .footer-row { display: grid; }
  }
`;

const indexStyles = `
${commonStyles}
  .hero { padding: 72px 0 48px; border-bottom: 1px solid var(--line); }
  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.7fr);
    gap: 56px;
    align-items: end;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 22px;
    color: var(--green);
    font-size: 13px;
    font-weight: 850;
  }
  .eyebrow::before {
    content: "";
    width: 8px;
    height: 8px;
    background: var(--green);
    border-radius: 50%;
  }
  h1 {
    margin: 0;
    max-width: 840px;
    font-size: clamp(42px, 7vw, 86px);
    line-height: 0.98;
    font-weight: 920;
    letter-spacing: 0;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  .hero-copy {
    margin: 26px 0 0;
    max-width: 680px;
    color: var(--muted);
    font-size: 19px;
    line-height: 1.68;
    font-weight: 520;
    word-break: keep-all;
  }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
  .hero-panel {
    position: relative;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: #fffdf8;
    overflow: hidden;
  }
  .panel-image {
    height: 320px;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 0;
  }
  .panel-image::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0) 26%, rgba(0,0,0,0.78) 100%);
    pointer-events: none;
  }
  .panel-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .panel-image img:first-child { border-right: 1px solid var(--line); }
  .panel-body { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px; color: #fff; }
  .panel-label { margin: 0 0 10px; color: var(--green); font-size: 12px; font-weight: 900; letter-spacing: 0; }
  .panel-title {
    margin: 0;
    font-size: 24px;
    line-height: 1.2;
    font-weight: 900;
    letter-spacing: 0;
    word-break: keep-all;
    overflow-wrap: anywhere;
    color: #fff;
  }
  .panel-meta { margin: 16px 0 0; color: rgba(255,255,255,0.78); font-size: 13px; line-height: 1.55; }
  .section { padding: 56px 0; border-bottom: 1px solid var(--line); }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    margin-bottom: 22px;
  }
  h2 { margin: 0; font-size: clamp(28px, 4vw, 46px); line-height: 1.1; font-weight: 900; letter-spacing: 0; }
  .section-sub {
    margin: 10px 0 0;
    max-width: 620px;
    color: var(--muted);
    font-size: 16px;
    line-height: 1.7;
    word-break: keep-all;
  }
  .small-link { color: var(--green); font-size: 14px; font-weight: 850; white-space: nowrap; }
  .topic-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid var(--line-strong);
    border-left: 1px solid var(--line-strong);
    background: #fffdf8;
  }
  .topic {
    min-height: 176px;
    padding: 20px;
    border-right: 1px solid var(--line-strong);
    border-bottom: 1px solid var(--line-strong);
  }
  .topic:nth-child(2n) { background: #fff; }
  .topic:nth-child(3n) { background: var(--blue-soft); }
  .topic:nth-child(4n) { background: var(--yellow-soft); }
  .topic:nth-child(5n) { background: var(--green-soft); }
  .topic-count { display: block; color: var(--muted); font-size: 12px; font-weight: 850; margin-bottom: 38px; }
  .topic h3 { margin: 0; font-size: 20px; line-height: 1.25; font-weight: 900; letter-spacing: 0; word-break: keep-all; }
  .topic p { margin: 10px 0 0; color: #5d5a52; font-size: 14px; line-height: 1.55; word-break: keep-all; }
  .content-layout {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 34px;
    align-items: start;
  }
  .filter-list { position: sticky; top: 92px; display: grid; gap: 8px; }
  .filter-list a {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 14px;
    font-weight: 750;
  }
  .filter-list strong { color: var(--ink); font-weight: 850; }
  .article-list { border-top: 1px solid var(--line-strong); }
  .article {
    display: grid;
    grid-template-columns: 132px minmax(0, 1fr) 92px;
    gap: 22px;
    padding: 24px 0;
    border-bottom: 1px solid var(--line);
  }
  .article-meta { color: var(--muted); font-size: 13px; line-height: 1.45; font-weight: 750; }
  .article h3 {
    margin: 0;
    font-size: clamp(22px, 3vw, 34px);
    line-height: 1.18;
    letter-spacing: 0;
    font-weight: 900;
    word-break: keep-all;
  }
  .article h3 a { border-bottom: 1px solid transparent; }
  .article h3 a:hover { border-bottom-color: var(--ink); }
  .article p { margin: 14px 0 0; color: var(--muted); font-size: 15px; line-height: 1.7; word-break: keep-all; }
  .article-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
  .read-link {
    align-self: start;
    justify-self: end;
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    padding: 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: #fff;
    color: var(--ink);
    font-size: 12px;
    font-weight: 850;
  }
  .cta-band {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 24px;
    align-items: center;
    padding: 36px;
    border: 1px solid var(--ink);
    border-radius: 8px;
    background: var(--ink);
    color: #fff;
  }
  .cta-band p { margin: 12px 0 0; max-width: 650px; color: rgba(255,255,255,0.72); font-size: 16px; line-height: 1.65; }
  .cta-band .button { background: #fff; color: var(--ink); border-color: #fff; }
  @media (max-width: 980px) {
    .hero-grid, .content-layout, .cta-band { grid-template-columns: 1fr; }
    .topic-grid { grid-template-columns: repeat(2, 1fr); }
    .filter-list { position: static; grid-template-columns: repeat(2, 1fr); margin-bottom: 18px; }
    .article { grid-template-columns: 1fr; gap: 12px; }
    .read-link { justify-self: start; }
  }
  @media (max-width: 640px) {
    .hero { padding: 48px 0 36px; }
    h1 { max-width: 360px; font-size: clamp(38px, 13vw, 52px); line-height: 1.05; }
    .hero-copy { font-size: 16px; max-width: 360px; }
    .panel-image { height: 316px; }
    .panel-title {
      font-size: 22px;
      word-break: normal;
    }
    .topic-grid, .filter-list { grid-template-columns: 1fr; }
    .topic { min-height: auto; }
    .topic-count { margin-bottom: 20px; }
    .section { padding: 42px 0; }
    .section-head { display: block; }
    .small-link { display: inline-flex; margin-top: 12px; }
    .article h3 { font-size: 24px; }
    .cta-band { padding: 24px; }
  }
`;

const articleStyles = `
${commonStyles}
  .article-hero {
    padding: 64px 0 42px;
    border-bottom: 1px solid var(--line);
  }
  .crumb {
    display: inline-flex;
    margin-bottom: 28px;
    color: var(--green);
    font-size: 14px;
    font-weight: 850;
  }
  .article-kicker {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0 0 18px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
  }
  h1 {
    margin: 0;
    max-width: 980px;
    font-size: clamp(38px, 6.2vw, 72px);
    line-height: 1.04;
    font-weight: 920;
    letter-spacing: 0;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  .lead {
    margin: 26px 0 0;
    max-width: 760px;
    color: #4f4b43;
    font-size: 20px;
    line-height: 1.72;
    font-weight: 560;
    word-break: keep-all;
  }
  .article-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 24px; }
  .article-layout {
    display: grid;
    grid-template-columns: 240px minmax(0, 760px);
    gap: 56px;
    align-items: start;
    padding: 56px 0;
    border-bottom: 1px solid var(--line);
  }
  .toc {
    position: sticky;
    top: 96px;
    display: grid;
    gap: 10px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 750;
  }
  .toc a { padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .article-body { font-size: 18px; line-height: 1.85; color: #2c2a25; word-break: keep-all; }
  .article-body h2 {
    margin: 46px 0 14px;
    font-size: 30px;
    line-height: 1.22;
    font-weight: 900;
    letter-spacing: 0;
  }
  .article-body h2:first-child { margin-top: 0; }
  .article-body p { margin: 0 0 18px; }
  .article-body ul {
    margin: 16px 0 24px;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }
  .article-body li {
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fffdf8;
  }
  .example {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 18px 0 28px;
  }
  .example div {
    padding: 18px;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: #fff;
  }
  .example strong {
    display: block;
    margin-bottom: 10px;
    color: var(--green);
    font-size: 13px;
  }
  .note {
    margin: 32px 0;
    padding: 22px;
    border-radius: 8px;
    border: 1px solid #b9d8c5;
    background: var(--green-soft);
  }
  .related {
    padding: 44px 0 60px;
  }
  .related h2 {
    margin: 0 0 18px;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 900;
  }
  .related-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .related-card {
    min-height: 150px;
    padding: 18px;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: #fff;
  }
  .related-card span {
    display: block;
    margin-bottom: 18px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 800;
  }
  .related-card strong {
    font-size: 18px;
    line-height: 1.35;
    word-break: keep-all;
  }
  @media (max-width: 900px) {
    .article-layout { grid-template-columns: 1fr; gap: 30px; }
    .toc { position: static; grid-template-columns: repeat(2, 1fr); }
    .related-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .article-hero { padding: 42px 0 32px; }
    h1 {
      max-width: 100%;
      font-size: clamp(26px, 7.2vw, 32px);
      line-height: 1.12;
      word-break: break-all;
      overflow-wrap: anywhere;
    }
    .lead {
      font-size: 17px;
      word-break: normal;
      overflow-wrap: anywhere;
    }
    .article-layout { padding: 38px 0; }
    .article-body {
      font-size: 16px;
      line-height: 1.78;
      word-break: normal;
      overflow-wrap: anywhere;
    }
    .article-body h2 { font-size: 24px; }
    .toc, .example { grid-template-columns: 1fr; }
  }
`;

function renderIndex() {
  const featured = articles[0];
  const clusterCounts = articles.reduce((counts, article) => {
    counts.set(article.cluster, (counts.get(article.cluster) ?? 0) + 1);
    return counts;
  }, new Map());
  const topicCards = Object.entries(clusterGuides)
    .map(([cluster, guide]) => {
      const count = clusterCounts.get(cluster) ?? 0;
      return `<article class="topic"><span class="topic-count">${count} articles</span><h3>${escapeHtml(cluster)}</h3><p>${escapeHtml(guide.topicCopy)}</p></article>`;
    })
    .join("\n          ");
  const filterLinks = Object.keys(clusterGuides)
    .map((cluster) => `<a href="#articles">${escapeHtml(cluster)}<span>${clusterCounts.get(cluster) ?? 0}</span></a>`)
    .join("\n          ");
  const cards = articles
    .map(
      (article) => `
            <article class="article" id="${article.id}">
              <div class="article-meta">${article.id}<br />${escapeHtml(article.cluster)}</div>
              <div>
                <h3><a href="${articleUrl(article)}">${escapeHtml(article.title)}</a></h3>
                <p>${escapeHtml(article.summary)}</p>
                <div class="article-tags">${renderTags(article)}</div>
              </div>
              <a class="read-link" href="${articleUrl(article)}">읽기</a>
            </article>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Doripe Blog - 작은 공간을 위한 로컬 마케팅 플레이북</title>
<meta name="description" content="식당, 카페, 샵, 바, 전시공간처럼 작은 로컬 공간이 더 잘 발견되고 저장되고 방문 후보가 되기 위한 마케팅 플레이북입니다." />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${siteUrl}/blog" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Doripe" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:title" content="Doripe Blog - 작은 공간을 위한 로컬 마케팅 플레이북" />
<meta property="og:description" content="작은 로컬 공간이 더 잘 발견되고 저장되고 방문 후보가 되기 위한 마케팅 플레이북입니다." />
<meta property="og:url" content="${siteUrl}/blog" />
<meta property="og:image" content="${siteUrl}/og-image-v2.png" />
<meta property="og:image:alt" content="Doripe 소개 이미지" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Doripe Blog - 작은 공간을 위한 로컬 마케팅 플레이북" />
<meta name="twitter:description" content="식당, 카페, 샵, 바, 전시공간을 위한 로컬 마케팅 자료실입니다." />
<meta name="twitter:image" content="${siteUrl}/og-image-v2.png" />
<meta name="twitter:image:alt" content="Doripe 소개 이미지" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" type="image/png" href="/favicon.png" />
<link rel="apple-touch-icon" href="/favicon.png" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "Doripe Blog",
  "url": "${siteUrl}/blog",
  "inLanguage": "ko-KR",
  "description": "작은 로컬 공간을 위한 로컬 마케팅 플레이북",
  "publisher": {
    "@type": "Organization",
    "name": "Doripe",
    "url": "${siteUrl}/"
  }
}
</script>
<style>${indexStyles}</style>
</head>
<body>
  <header class="topbar">
    <nav class="shell nav" aria-label="main navigation">
      <a class="brand" href="/">Doripe<span>.</span></a>
      <div class="navlinks">
        <a href="/" aria-label="Doripe home">홈</a>
        <a href="/business">공간 파일럿</a>
        <a href="/blog" aria-current="page">블로그</a>
        <a class="nav-cta" href="/business">파일럿 문의</a>
      </div>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="shell hero-grid">
        <div>
          <p class="eyebrow">Doripe Blog</p>
          <h1>작은 공간을 위한 로컬 마케팅 플레이북</h1>
          <p class="hero-copy">
            식당, 카페, 샵, 바, 전시공간이 더 잘 발견되고 저장되고 방문 후보가 되기 위한 실무 노트를 모았습니다. 노출 순위보다, 손님이 공간을 기억하는 장면을 먼저 다룹니다.
          </p>
          <div class="hero-actions">
            <a class="button primary" href="#articles">발행 글 읽기</a>
            <a class="button" href="#topics">주제 둘러보기</a>
          </div>
        </div>

        <aside class="hero-panel" aria-label="featured article">
          <a href="${articleUrl(featured)}">
            <div class="panel-image">
              <img src="/img/oguzhan-tasimaz-LdUQiz69jc4-unsplash.jpg" alt="창가가 있는 로컬 공간" />
              <img src="/img/klara-kulikova-yjQDnOhGE34-unsplash.jpg" alt="작은 식당의 테이블" />
            </div>
            <div class="panel-body">
              <p class="panel-label">FEATURED ARTICLE</p>
              <h2 class="panel-title">${escapeHtml(featured.title)}</h2>
              <p class="panel-meta">${featured.id} · ${escapeHtml(featured.spaces.join(", "))} · ${escapeHtml(featured.keyword)}</p>
            </div>
          </a>
        </aside>
      </div>
    </section>

    <section id="topics" class="section">
      <div class="shell">
        <div class="section-head">
          <div>
            <h2>문제별로 읽는 자료실</h2>
            <p class="section-sub">업종보다 먼저 운영자가 겪는 문제를 기준으로 묶었습니다. 같은 고민은 식당, 카페, 샵, 바, 전시공간에서 반복됩니다.</p>
          </div>
          <a class="small-link" href="/business">공간 파일럿 문의</a>
        </div>

        <div class="topic-grid">
          ${topicCards}
        </div>
      </div>
    </section>

    <section id="articles" class="section">
      <div class="shell content-layout">
        <aside class="filter-list" aria-label="article categories">
          <a href="#articles"><strong>전체 글</strong><span>${articles.length}</span></a>
          ${filterLinks}
        </aside>

        <div>
          <div class="section-head">
            <div>
              <h2>바로 읽는 글</h2>
              <p class="section-sub">파일럿 공간 운영자가 지금 바로 점검할 수 있게 100개 글을 열었습니다. 모든 글은 식당, 카페, 샵, 바, 갤러리, 서점, 공방을 섞어 다룹니다.</p>
            </div>
          </div>

          <div class="article-list">${cards}
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell">
        <div class="cta-band">
          <div>
            <h2>우리 공간은 어떤 장면으로 기억될까요?</h2>
            <p>Doripe는 작은 공간을 취향 기반 카드로 소개하는 파일럿을 만들고 있습니다. 공간이 어떤 장면으로 보이면 좋을지 함께 테스트할 수 있어요.</p>
          </div>
          <a class="button" href="/business">파일럿 문의</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="shell footer-row">
      <div>
        <strong>Doripe.</strong><br />
        <span>© 2026 Doripe</span>
      </div>
      <div class="footer-links">
        <a href="/">홈</a>
        <a href="/business">공간 파일럿</a>
        <a href="/terms">이용약관</a>
        <a href="/privacy">개인정보처리방침</a>
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

function renderArticle(article) {
  const relatedCards = article.related
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(
      (related) => `
          <a class="related-card" href="${articleUrl(related)}">
            <span>${related.id} · ${escapeHtml(related.cluster)}</span>
            <strong>${escapeHtml(related.title)}</strong>
          </a>`
    )
    .join("\n");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.summary,
    url: `${siteUrl}${articleUrl(article)}`,
    datePublished: lastmod,
    dateModified: lastmod,
    inLanguage: "ko-KR",
    author: { "@type": "Organization", name: "Doripe" },
    publisher: { "@type": "Organization", name: "Doripe", url: `${siteUrl}/` }
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(article.title)} | Doripe Blog</title>
<meta name="description" content="${escapeHtml(article.summary)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${siteUrl}${articleUrl(article)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Doripe" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:title" content="${escapeHtml(article.title)}" />
<meta property="og:description" content="${escapeHtml(article.summary)}" />
<meta property="og:url" content="${siteUrl}${articleUrl(article)}" />
<meta property="og:image" content="${siteUrl}/og-image-v2.png" />
<meta property="article:published_time" content="${lastmod}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(article.title)}" />
<meta name="twitter:description" content="${escapeHtml(article.summary)}" />
<meta name="twitter:image" content="${siteUrl}/og-image-v2.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="alternate icon" type="image/png" href="/favicon.png" />
<link rel="apple-touch-icon" href="/favicon.png" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>
<style>${articleStyles}</style>
</head>
<body>
  <header class="topbar">
    <nav class="shell nav" aria-label="main navigation">
      <a class="brand" href="/">Doripe<span>.</span></a>
      <div class="navlinks">
        <a href="/" aria-label="Doripe home">홈</a>
        <a href="/business">공간 파일럿</a>
        <a href="/blog" aria-current="page">블로그</a>
        <a class="nav-cta" href="/business">파일럿 문의</a>
      </div>
    </nav>
  </header>

  <main>
    <section class="article-hero">
      <div class="shell">
        <a class="crumb" href="/blog">← 블로그 홈</a>
        <p class="article-kicker"><span>${article.id}</span><span>${escapeHtml(article.cluster)}</span><span>${escapeHtml(article.keyword)}</span></p>
        <h1>${breakableKorean(article.title)}</h1>
        <p class="lead">${escapeHtml(article.lead)}</p>
        <div class="article-tags">${renderTags(article)}</div>
      </div>
    </section>

    <div class="shell article-layout">
      <aside class="toc" aria-label="article sections">
        <a href="#problem">문제 보기</a>
        <a href="#checklist">점검할 것</a>
        <a href="#example">문구 예시</a>
        <a href="#doripe">Doripe 관점</a>
      </aside>

      <article class="article-body">
        <h2 id="problem">먼저 문제를 좁혀야 합니다</h2>
        <p>${escapeHtml(article.summary)}</p>
        <p>운영자가 보기에는 이미 충분히 설명했다고 느낄 수 있습니다. 하지만 처음 보는 손님은 훨씬 적은 정보로 판단합니다. 그래서 이 문제는 더 많이 말하는 방식이 아니라, 손님이 실제로 망설이는 지점을 먼저 보여주는 방식으로 풀어야 합니다.</p>
        <ul>
          ${article.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("\n          ")}
        </ul>

        <h2 id="checklist">이번 주에 바로 점검할 것</h2>
        <p>아래 항목은 광고비를 쓰기 전에 먼저 확인할 수 있는 기본 정리입니다. 모든 항목을 한 번에 고치기보다, 손님이 처음 보는 화면부터 순서대로 고치는 편이 좋습니다.</p>
        <ul>
          ${article.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ")}
        </ul>

        <h2 id="example">운영자 문구를 방문자 문구로 바꾸기</h2>
        <p>좋은 공간일수록 운영자는 많은 맥락을 알고 있습니다. 하지만 손님은 그 맥락을 모릅니다. 문구는 운영자가 하고 싶은 설명보다 손님이 판단할 수 있는 장면에 가까워야 합니다.</p>
        <div class="example">
          <div>
            <strong>Before</strong>
            <p>${escapeHtml(article.before)}</p>
          </div>
          <div>
            <strong>After</strong>
            <p>${escapeHtml(article.after)}</p>
          </div>
        </div>

        <h2 id="doripe">Doripe 관점</h2>
        <div class="note">
          <p>${escapeHtml(article.doripe)}</p>
        </div>
        <p>핵심은 큰 캠페인을 만드는 것이 아닙니다. 손님이 이미 보고 있는 지도, 인스타, 소개 문구, 현장 안내에서 같은 장면을 반복해서 발견하게 만드는 일입니다. 작은 공간일수록 한 문장과 한 장의 사진이 방문 결정에 가까운 역할을 합니다.</p>
      </article>
    </div>

    <section class="shell related">
      <h2>함께 읽기</h2>
      <div class="related-grid">${relatedCards}
      </div>
    </section>
  </main>

  <footer>
    <div class="shell footer-row">
      <div>
        <strong>Doripe.</strong><br />
        <span>© 2026 Doripe</span>
      </div>
      <div class="footer-links">
        <a href="/">홈</a>
        <a href="/business">공간 파일럿</a>
        <a href="/terms">이용약관</a>
        <a href="/privacy">개인정보처리방침</a>
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

function renderSitemap() {
  const urls = [
    { loc: "/", lastmod: "2026-05-10", changefreq: "weekly", priority: "1.0" },
    { loc: "/notify", lastmod: "2026-05-10", changefreq: "monthly", priority: "0.8" },
    { loc: "/business", lastmod: "2026-05-10", changefreq: "monthly", priority: "0.7" },
    { loc: "/blog", lastmod, changefreq: "weekly", priority: "0.8" },
    ...articles.map((article) => ({
      loc: articleUrl(article),
      lastmod,
      changefreq: "monthly",
      priority: "0.7"
    }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${siteUrl}${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

await mkdir(articleDir, { recursive: true });
await writeFile(path.join(publicDir, "blog.html"), renderIndex(), "utf8");
await Promise.all(
  articles.map((article) => writeFile(path.join(articleDir, `${article.slug}.html`), renderArticle(article), "utf8"))
);
await writeFile(path.join(publicDir, "sitemap.xml"), renderSitemap(), "utf8");

console.log(`[blog] generated ${articles.length} articles`);

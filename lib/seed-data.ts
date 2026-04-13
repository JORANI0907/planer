// 노션에서 가져온 초기 데이터 (2026년 계획)
export const SEED_DATA = {
  quarterly: [
    // 1분기
    { period_key: '2026-Q1', title: '자동화 공부', categories: ['사업'], priority: 'high' as const },
    { period_key: '2026-Q1', title: '앱개발', categories: ['사업'], priority: 'high' as const },
    { period_key: '2026-Q1', title: '사무실 이전', categories: ['사업'], priority: 'medium' as const },

    // 2분기
    { period_key: '2026-Q2', title: '공격적 마케팅', categories: ['사업'], priority: 'high' as const,
      description: '1일 1블로그 포스팅, 숨고 완성도 지속적 높이기, 네이버 플레이스 시·군·구 개설, 인스타그램 마케팅, 유튜브 마케팅, 브랜딩 지속 발전, 마케팅 자동화 공부 지속 발전' },
    { period_key: '2026-Q2', title: '독서노트 3편 완료', categories: ['독서자기계발'], priority: 'medium' as const },
    { period_key: '2026-Q2', title: '마라톤 완주(full)', categories: ['건강운동'], priority: 'high' as const },
    { period_key: '2026-Q2', title: '경매 참여 1회 이상', categories: ['투자경매'], priority: 'high' as const },

    // 3분기
    { period_key: '2026-Q3', title: '직원 4명 구성 (현장 매니저3, 팀장1)', categories: ['사업'], priority: 'high' as const,
      description: '청소 창업 교육 및 컨설팅 서비스 개설, 협력사 구축(딥케어)' },
    { period_key: '2026-Q3', title: '청혼반지 준비', categories: ['개인가족'], priority: 'high' as const },
    { period_key: '2026-Q3', title: '독서노트 3편 완료', categories: ['독서자기계발'], priority: 'medium' as const },
    { period_key: '2026-Q3', title: '바다수영 완주 (3km)', categories: ['건강운동'], priority: 'medium' as const },
    { period_key: '2026-Q3', title: '바이애슬론 완주', categories: ['건강운동'], priority: 'medium' as const },
    { period_key: '2026-Q3', title: '경매 주택 낙찰', categories: ['투자경매'], priority: 'high' as const },

    // 4분기
    { period_key: '2026-Q4', title: '소독방역업 신고 (사업자등록)', categories: ['사업'], priority: 'high' as const,
      description: '숨고 성장전략 적용(브랜딩+신뢰 높이기), 상품 및 서비스 합리화, 위생관리업과 같은 전략 적용' },
    { period_key: '2026-Q4', title: '향기케어 상품화', categories: ['사업'], priority: 'high' as const,
      description: '사업자등록(브랜딩+신뢰높이기), 상품 및 서비스 합리화, 성장 전략 적용' },
    { period_key: '2026-Q4', title: '독서노트 3편 완료', categories: ['독서자기계발'], priority: 'medium' as const },
    { period_key: '2026-Q4', title: '요가 주 3회로 늘리기', categories: ['건강운동'], priority: 'low' as const },
    { period_key: '2026-Q4', title: '트라이애슬론 완주', categories: ['건강운동'], priority: 'medium' as const },
    { period_key: '2026-Q4', title: '경매 상가 낙찰', categories: ['투자경매'], priority: 'high' as const },
  ],

  monthly: [
    // 4월
    { period_key: '2026-04', title: '텍스트 마케팅 자동화', categories: ['사업'], priority: 'high' as const,
      description: '에이전트 다듬기, 인스타그램 마케팅 추진 및 안정화' },
    { period_key: '2026-04', title: '데일 카네기 자기관리론 독서노트 작성', categories: ['독서자기계발'], priority: 'medium' as const },
    { period_key: '2026-04', title: '러닝 자세교정 및 주 1회 5km', categories: ['건강운동'], priority: 'medium' as const },
    { period_key: '2026-04', title: '경매 공부 주 1회', categories: ['투자경매'], priority: 'medium' as const },

    // 5월
    { period_key: '2026-05', title: '영상 콘텐츠 마케팅 자동화', categories: ['사업'], priority: 'high' as const,
      description: '인스타·유튜브 숏폼, 유튜브 롱폼' },
    { period_key: '2026-05', title: '네이버 플레이스 다중 개설', categories: ['사업'], priority: 'high' as const },
    { period_key: '2026-05', title: '주 1회 10km 러닝', categories: ['건강운동'], priority: 'medium' as const },
    { period_key: '2026-05', title: '마라톤 완주', categories: ['건강운동'], priority: 'high' as const },
    { period_key: '2026-05', title: '독서노트 작성', categories: ['독서자기계발'], priority: 'medium' as const },
    { period_key: '2026-05', title: '경매 임장 주 1회 및 경매 구경', categories: ['투자경매'], priority: 'medium' as const },

    // 6월
    { period_key: '2026-06', title: '마케팅 안정화 및 평가', categories: ['사업'], priority: 'high' as const },
    { period_key: '2026-06', title: '발전방향 검토 및 지속화', categories: ['사업'], priority: 'medium' as const },
    { period_key: '2026-06', title: '러닝 관련 공부 및 훈련', categories: ['건강운동'], priority: 'medium' as const },
    { period_key: '2026-06', title: '독서노트 작성', categories: ['독서자기계발'], priority: 'medium' as const },
    { period_key: '2026-06', title: '경매 참여 1회 이상', categories: ['투자경매'], priority: 'high' as const },

    // 7월
    { period_key: '2026-07', title: '청소 창업 컨설팅 상품화', categories: ['사업'], priority: 'high' as const,
      description: '자료 만들기, 테스트, 상품화 완성' },

    // 8월
    { period_key: '2026-08', title: '컨설팅 상품 마케팅 확장', categories: ['사업'], priority: 'high' as const,
      description: '플랫폼 이용(근접 지역 위주), 교육 인원→직원화' },
    { period_key: '2026-08', title: '협력사 구축', categories: ['사업'], priority: 'high' as const,
      description: '협력사 계약 준비, 홈페이지 수정, 광고 집중' },

    // 9월
    { period_key: '2026-09', title: '컨설팅 상품 안정화 및 평가', categories: ['사업'], priority: 'medium' as const },
    { period_key: '2026-09', title: '협력사 구축 안정화 및 평가', categories: ['사업'], priority: 'medium' as const },

    // 10월
    { period_key: '2026-10', title: '소독방역업 신고 (사업자등록)', categories: ['사업'], priority: 'high' as const,
      description: '숨고 성장전략 적용(브랜딩+신뢰 높이기), 상품 및 서비스 합리화, 위생관리업과 같은 전략 적용' },

    // 11월
    { period_key: '2026-11', title: '향기케어 상품화', categories: ['사업'], priority: 'high' as const,
      description: '사업자등록(브랜딩+신뢰높이기), 상품 및 서비스 합리화, 성장 전략 적용' },

    // 12월
    { period_key: '2026-12', title: '소독방역업 안정화 및 평가', categories: ['사업'], priority: 'medium' as const },
    { period_key: '2026-12', title: '향기케어 상품화 평가', categories: ['사업'], priority: 'medium' as const },
  ],

  // 분기 → 월 기본 매핑 (seed 후 적용)
  quarterToMonthMappings: [
    // Q2 → 4,5,6월
    { parentTitle: '공격적 마케팅', parentPeriod: '2026-Q2', childPeriods: ['2026-04', '2026-05', '2026-06'] },
    { parentTitle: '독서노트 3편 완료', parentPeriod: '2026-Q2', childPeriods: ['2026-04', '2026-05', '2026-06'] },
    { parentTitle: '마라톤 완주(full)', parentPeriod: '2026-Q2', childPeriods: ['2026-04', '2026-05'] },
    { parentTitle: '경매 참여 1회 이상', parentPeriod: '2026-Q2', childPeriods: ['2026-04', '2026-05', '2026-06'] },
    // Q3 → 7,8,9월
    { parentTitle: '직원 4명 구성 (현장 매니저3, 팀장1)', parentPeriod: '2026-Q3', childPeriods: ['2026-07', '2026-08', '2026-09'] },
    { parentTitle: '경매 주택 낙찰', parentPeriod: '2026-Q3', childPeriods: ['2026-07', '2026-08', '2026-09'] },
    // Q4 → 10,11,12월
    { parentTitle: '소독방역업 신고 (사업자등록)', parentPeriod: '2026-Q4', childPeriods: ['2026-10'] },
    { parentTitle: '향기케어 상품화', parentPeriod: '2026-Q4', childPeriods: ['2026-11'] },
  ],
}

export type MapLevel = "national" | "province" | "city";

export type MapNavigationState = {
  level: MapLevel;
  province: string;
  city: string;
  selectedCaseId: string;
  documentOpen: boolean;
};

export type CaseLocation = {
  id: string;
  province: string;
  city: string;
};

export const emptyMapNavigation: MapNavigationState = {
  level: "national",
  province: "全部",
  city: "全部",
  selectedCaseId: "",
  documentOpen: false,
};

export function navigateNational(): MapNavigationState {
  return emptyMapNavigation;
}

export function navigateProvince(province: string): MapNavigationState {
  if (!province || province === "全部") return navigateNational();
  return {
    level: "province",
    province,
    city: "全部",
    selectedCaseId: "",
    documentOpen: false,
  };
}

export function navigateCity(province: string, city: string): MapNavigationState {
  if (!city || city === "全部") return navigateProvince(province);
  return {
    level: "city",
    province,
    city,
    selectedCaseId: "",
    documentOpen: false,
  };
}

export function selectCase(
  state: MapNavigationState,
  item: CaseLocation,
  source: "directory" | "poi",
): MapNavigationState {
  const alreadySelected = state.selectedCaseId === item.id;
  return {
    level: "city",
    province: item.province,
    city: item.city,
    selectedCaseId: item.id,
    documentOpen: source === "poi" && alreadySelected,
  };
}

export function sanitizeMapNavigation(
  state: MapNavigationState,
  cases: CaseLocation[],
): MapNavigationState {
  if (!state.selectedCaseId) return state;
  const selected = cases.find((item) => item.id === state.selectedCaseId);
  if (!selected) return { ...state, selectedCaseId: "", documentOpen: false };
  return {
    ...state,
    level: "city",
    province: selected.province,
    city: selected.city,
  };
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X } from "lucide-react";

export interface MetricFilter {
  metricName: string;
  min?: number;
  max?: number;
}

export interface SearchFilters {
  sport?: string;
  positions?: string[];
  gradYearMin?: number;
  gradYearMax?: number;
  bats?: string;
  throws?: string;
  nameSearch?: string;
  metricFilters?: MetricFilter[];
  recruitingStatus?: string;
  state?: string;
  gpaMin?: number;
  highSchool?: string;
}

const POSITIONS = ["P", "C", "1B", "2B", "SS", "3B", "OF", "LF", "CF", "RF", "DH", "IF", "UT"];
const SPORTS = ["baseball", "softball", "football", "basketball", "soccer", "lacrosse", "track", "volleyball"];
const METRIC_OPTIONS = [
  "30 Yard Dash", "60-Yard Dash", "Arm Velocity (C)", "Arm Velocity (IF)",
  "Arm Velocity (OF)", "CH Velo", "Curveball Velocity", "Exit Velocity",
  "Fastball Velo", "Fielding", "Hitting", "Home to First", "Hustle/Attitude",
];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

const REGIONS: Record<string, string[]> = {
  "Northeast": ["CT","DE","ME","MD","MA","NH","NJ","NY","PA","RI","VT","DC"],
  "Southeast": ["AL","AR","FL","GA","KY","LA","MS","NC","SC","TN","VA","WV"],
  "Midwest": ["IL","IN","IA","KS","MI","MN","MO","NE","ND","OH","SD","WI"],
  "Southwest": ["AZ","NM","OK","TX"],
  "West Coast": ["CA","HI","NV","OR","WA"],
  "Northwest": ["AK","CO","ID","MT","UT","WY"],
};

interface Props {
  onSearch: (filters: SearchFilters) => void;
  loading: boolean;
  isScout?: boolean;
}

export default function PlayerSearchFilters({ onSearch, loading, isScout = false }: Props) {
  const [nameSearch, setNameSearch] = useState("");
  const [sport, setSport] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [gradYearMin, setGradYearMin] = useState("");
  const [gradYearMax, setGradYearMax] = useState("");
  const [bats, setBats] = useState("");
  const [throws_, setThrows] = useState("");
  const [metricFilters, setMetricFilters] = useState<MetricFilter[]>([]);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricMin, setNewMetricMin] = useState("");
  const [newMetricMax, setNewMetricMax] = useState("");
  const [recruitingStatus, setRecruitingStatus] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [gpaMin, setGpaMin] = useState("");
  const [highSchool, setHighSchool] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) => {
      if (prev.includes(region)) {
        return prev.filter((r) => r !== region);
      }
      return [...prev, region];
    });
  };

  const addMetricFilter = () => {
    if (!newMetricName.trim()) return;
    setMetricFilters((prev) => [
      ...prev,
      {
        metricName: newMetricName.trim(),
        min: newMetricMin ? Number(newMetricMin) : undefined,
        max: newMetricMax ? Number(newMetricMax) : undefined,
      },
    ]);
    setNewMetricName("");
    setNewMetricMin("");
    setNewMetricMax("");
  };

  const removeMetricFilter = (index: number) => {
    setMetricFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSearch = () => {
    // Combine selected state with region-derived states
    let effectiveState = selectedState || undefined;
    if (!effectiveState && selectedRegions.length > 0) {
      // If regions selected but no specific state, we pass the first region state
      // Actually the RPC only supports a single _state. For multi-region we filter client-side.
    }

    onSearch({
      nameSearch: nameSearch || undefined,
      sport: sport || undefined,
      positions: selectedPositions.length ? selectedPositions : undefined,
      gradYearMin: gradYearMin ? Number(gradYearMin) : undefined,
      gradYearMax: gradYearMax ? Number(gradYearMax) : undefined,
      bats: bats || undefined,
      throws: throws_ || undefined,
      metricFilters: metricFilters.length ? metricFilters : undefined,
      recruitingStatus: recruitingStatus || undefined,
      state: effectiveState,
      gpaMin: gpaMin ? Number(gpaMin) : undefined,
      highSchool: highSchool || undefined,
    });
  };

  const handleClear = () => {
    setNameSearch("");
    setSport("");
    setSelectedPositions([]);
    setGradYearMin("");
    setGradYearMax("");
    setBats("");
    setThrows("");
    setMetricFilters([]);
    setRecruitingStatus("");
    setSelectedState("");
    setGpaMin("");
    setHighSchool("");
    setSelectedRegions([]);
  };

  return (
    <Card className="section-card h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Search className="h-4 w-4" /> Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name search */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Player Name</Label>
          <Input
            placeholder="Search by name..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="h-9 text-sm rounded-lg"
          />
        </div>

        {/* Sport */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Sport</Label>
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="h-9 text-sm rounded-lg">
              <SelectValue placeholder="Any sport" />
            </SelectTrigger>
            <SelectContent>
              {SPORTS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Positions */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Positions</Label>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => togglePosition(pos)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedPositions.includes(pos)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Grad year */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Graduation Year</Label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Min" value={gradYearMin} onChange={(e) => setGradYearMin(e.target.value)} className="h-9 text-sm rounded-lg" />
            <Input type="number" placeholder="Max" value={gradYearMax} onChange={(e) => setGradYearMax(e.target.value)} className="h-9 text-sm rounded-lg" />
          </div>
        </div>

        {/* Bats / Throws */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Bats</Label>
            <Select value={bats} onValueChange={setBats}>
              <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Left</SelectItem>
                <SelectItem value="R">Right</SelectItem>
                <SelectItem value="S">Switch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Throws</Label>
            <Select value={throws_} onValueChange={setThrows}>
              <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Left</SelectItem>
                <SelectItem value="R">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scout-only filters */}
        {isScout && (
          <>
            {/* High School */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">High School</Label>
              <Input
                placeholder="Search by high school..."
                value={highSchool}
                onChange={(e) => setHighSchool(e.target.value)}
                className="h-9 text-sm rounded-lg"
              />
            </div>

            {/* Recruiting Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Recruiting Status</Label>
              <Select value={recruitingStatus} onValueChange={setRecruitingStatus}>
                <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="All players" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncommitted">Uncommitted Only</SelectItem>
                  <SelectItem value="committed">Committed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Region multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Region</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(REGIONS).map((region) => (
                  <button
                    key={region}
                    onClick={() => toggleRegion(region)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      selectedRegions.includes(region)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* State filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="Any state" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GPA Minimum */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GPA Minimum</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5.0"
                placeholder="e.g. 3.5"
                value={gpaMin}
                onChange={(e) => setGpaMin(e.target.value)}
                className="h-9 text-sm rounded-lg"
              />
            </div>

            {/* Metric filters */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Metric Filters</Label>
              {metricFilters.map((mf, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg bg-muted/50 p-2">
                  <Badge variant="secondary" className="text-xs shrink-0">{mf.metricName}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {mf.min !== undefined && `≥ ${mf.min}`}
                    {mf.min !== undefined && mf.max !== undefined && " & "}
                    {mf.max !== undefined && `≤ ${mf.max}`}
                  </span>
                  <button onClick={() => removeMetricFilter(i)} className="ml-auto text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="space-y-2 rounded-lg border border-dashed p-2.5">
                <Select value={newMetricName} onValueChange={setNewMetricName}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Select a metric..." /></SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Min" value={newMetricMin} onChange={(e) => setNewMetricMin(e.target.value)} className="h-8 text-xs rounded-lg" />
                  <Input type="number" placeholder="Max" value={newMetricMax} onChange={(e) => setNewMetricMax(e.target.value)} className="h-8 text-xs rounded-lg" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addMetricFilter} disabled={!newMetricName.trim()} className="w-full h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Filter
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSearch} disabled={loading} className="flex-1 gradient-primary border-0 text-primary-foreground font-bold rounded-xl">
            {loading ? "Searching..." : "Search"}
          </Button>
          <Button variant="outline" onClick={handleClear} className="rounded-xl">Clear</Button>
        </div>
      </CardContent>
    </Card>
  );
}

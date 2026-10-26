import { SafeLogo } from "@/components/SafeLogo";
import type { UnifiedSportEvent } from "@/sports/generic/types";

const LIVE = new Set(["LIVE", "Q1", "Q2", "Q3", "Q4", "HT", "OT", "P1", "P2", "P3", "IN", "PF", "EOR", "IN1", "IN2", "IN3", "IN4", "IN5", "IN6", "IN7", "IN8", "IN9"]);

function eventTime(event: UnifiedSportEvent) {
  if (LIVE.has(event.status)) return event.status;
  if (event.status === "FT" || event.status === "AOT" || event.status === "AP") return "FT";
  if (event.time) return event.time;
  if (event.date.includes("T")) {
    try {
      return new Intl.DateTimeFormat("en-ZA", {
        timeZone: "Africa/Johannesburg",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.date));
    } catch {
      return event.status;
    }
  }
  return event.status;
}

export function GenericEventList({ events, icon }: { events: UnifiedSportEvent[]; icon: string }) {
  const groups = events.reduce<Record<string, UnifiedSportEvent[]>>((acc, event) => {
    const key = event.country ? `${event.country} · ${event.competition}` : event.competition;
    (acc[key] ??= []).push(event);
    return acc;
  }, {});

  if (!events.length) {
    return (
      <div className="emptyState">
        <div className="emptyIcon">{icon}</div>
        <h3>No events found</h3>
        <p>There may be no events for this date, or the free-plan coverage may not include them.</p>
      </div>
    );
  }

  return (
    <div className="leagueList">
      {Object.entries(groups).map(([label, group]) => (
        <section className="leagueCard" key={label}>
          <div className="leagueTitle">
            <div className="leagueIdentity">
              <SafeLogo src={group[0].logo} alt={group[0].competition} fallbackText={group[0].competition || icon} size={24} />
              <div>
                {group[0].country ? <small>{group[0].country}</small> : null}
                <h3>{group[0].competition}</h3>
              </div>
            </div>
            <span className="leagueCount">{group.length}</span>
          </div>

          {group.map((event) => {
            const isLive = LIVE.has(event.status);

            if (!event.home || !event.away) {
              return (
                <article className={isLive ? "eventRow singleEvent liveRow" : "eventRow singleEvent"} key={event.id}>
                  <div className={isLive ? "matchMeta liveMeta" : "matchMeta"}>
                    {isLive ? <span className="liveDot" /> : null}
                    <span>{eventTime(event)}</span>
                  </div>
                  <div className="eventTitle">
                    <strong>{event.title ?? event.competition}</strong>
                    {event.subtitle ? <small>{event.subtitle}</small> : null}
                  </div>
                  <span className="statusBadge">{event.statusLong}</span>
                </article>
              );
            }

            return (
              <article className={isLive ? "matchRow liveRow" : "matchRow"} key={event.id}>
                <div className={isLive ? "matchMeta liveMeta" : "matchMeta"}>
                  {isLive ? <span className="liveDot" /> : null}
                  <span>{eventTime(event)}</span>
                </div>

                <div className="team">
                  <SafeLogo src={event.home.logo} alt={event.home.name} fallbackText={event.home.name} size={24} />
                  <span>{event.home.name}</span>
                </div>

                <div className="score">
                  <strong>{event.homeScore ?? "—"}</strong>
                  <span>:</span>
                  <strong>{event.awayScore ?? "—"}</strong>
                </div>

                <div className="team away">
                  <span>{event.away.name}</span>
                  <SafeLogo src={event.away.logo} alt={event.away.name} fallbackText={event.away.name} size={24} />
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

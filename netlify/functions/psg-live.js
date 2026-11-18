const { api, cached, jsonResponse, psgTeam, fixtureForApp } = require("./sportsapi");

exports.handler = async () => {
  try {
    const team = await psgTeam();
    const [upcoming, recent] = await Promise.all([
      cached("psg:upcoming", 5 * 60 * 1000, () => api(`/teams/${team.id}/fixtures?type=upcoming&page=0`)),
      cached("psg:recent", 60 * 1000, () => api(`/teams/${team.id}/fixtures?type=recent&page=0`))
    ]);

    const upcomingRows = (Array.isArray(upcoming) ? upcoming : []).map(fixtureForApp);
    const recentRows = (Array.isArray(recent) ? recent : []).map(fixtureForApp);
    const live = recentRows.filter(match => match.status === "EN DIRECT");

    return jsonResponse(200, {
      live,
      upcoming: upcomingRows,
      recent: recentRows,
      updatedAt: new Date().toISOString()
    }, 60);
  } catch (error) {
    console.error("psg-live:", error);
    return jsonResponse(error.statusCode || 502, {
      message: error.message || "Impossible de récupérer les matchs du PSG."
    });
  }
};

const { api, cached, jsonResponse, psgTeam } = require("./sportsapi");

exports.handler = async () => {
  try {
    const team = await psgTeam();
    const squad = await cached("psg:squad", 24 * 60 * 60 * 1000, () => api(`/teams/${team.id}/squad`));
    const players = (Array.isArray(squad) ? squad : []).map(player => ({
      id: player.id,
      name: player.name,
      position: player.position,
      heightCm: player.heightCm,
      dateOfBirth: player.dateOfBirth,
      image: player.image
    }));
    return jsonResponse(200, { players, updatedAt: new Date().toISOString() }, 3600);
  } catch (error) {
    console.error("psg-squad:", error);
    return jsonResponse(error.statusCode || 502, {
      message: error.message || "Impossible de récupérer l’effectif du PSG."
    });
  }
};

$version: "2"

namespace com.aws.solutions.deepracer

enum TrackId {
    A_TO_Z_SPEEDWAY = "reInvent2019_wide"
    ACE_SPEEDWAY = "2022_april_open"
    ACE_SUPER_SPEEDWAY = "2022_april_pro"
    AMERICAN_HILLS_SPEEDWAY = "Austin"
    ASIA_PACIFIC_BAY_LOOP = "Singapore"
    ASIA_PACIFIC_BAY_LOOP_BUILDINGS = "Singapore_building"
    AWS_SUMMIT_RACEWAY = "Vegas_track"
    BAADAL_TRACK = "AmericasGeneratedInclStart"
    BAJA_HIGHWAY = "dubai_pro"
    BAJA_TURNPIKE = "dubai_open"
    BOWTIE_TRACK = "Bowtie_track"
    BREADCENTRIC_LOOP = "2022_june_open"
    BREADCENTRIC_SPEEDWAY = "2022_june_pro"
    CIRCUIT_DE_BARCELONA_CATALUNYA = "Spain_track"
    COSMIC_CIRCUIT = "jyllandsringen_pro"
    COSMIC_LOOP = "jyllandsringen_open"
    CUMULO_CARRERA_TRAINING = "Mexico_track"
    CUMULO_TURNPIKE = "Belille"
    DBRO_RACEWAY = "2022_july_open"
    DBRO_SUPER_RACEWAY = "2022_july_pro"
    EMPIRE_CITY_TRAINING = "New_York_Track"
    EUROPEAN_SEASIDE_CIRCUIT = "Monaco"
    EUROPEAN_SEASIDE_CIRCUIT_BUILDINGS = "Monaco_building"
    EXPEDITION_LOOP = "red_star_open"
    EXPEDITION_SUPER_LOOP = "red_star_pro"
    FOREVER_RACEWAY = "2024_reinvent_champ"
    FUMIAKI_LOOP = "FS_June2020"
    HOT_ROD_SPEEDWAY = "arctic_open"
    HOT_ROD_SUPER_SPEEDWAY = "arctic_pro"
    JENNENS_FAMILY_SPEEDWAY = "2022_october_open"
    JENNENS_SUPER_SPEEDWAY = "2022_october_pro"
    JOCHEM_HIGHWAY = "2022_august_pro"
    JOCHEM_TURNPIKE = "2022_august_open"
    KUEI_RACEWAY = "hamption_open"
    KUEI_SUPER_RACEWAY = "hamption_pro"
    KUMO_TORAKKU_TRAINING = "Tokyo_Training_track"
    LARS_CIRCUIT = "thunder_hill_pro"
    LARS_LOOP = "thunder_hill_open"
    LONDON_LOOP_TRAINING = "Virtual_May19_Train_track"
    OVAL_TRACK = "Oval_track"
    PLAYA_RACEWAY = "morgan_open"
    PLAYA_SUPER_RACEWAY = "morgan_pro"
    PO_CHUN_SPEEDWAY = "penbay_open"
    PO_CHUN_SUPER_SPEEDWAY = "penbay_pro"
    REINVENT_2018 = "reinvent_base"
    REINVENT_2022_CHAMPIONSHIP = "2022_reinvent_champ"
    RL_SPEEDWAY = "2022_summit_speedway"
    ROGER_RACEWAY = "July_2020"
    ROGER_RING = "2022_september_open"
    ROGER_SUPER_RACEWAY = "2022_september_pro"
    ROGUE_CIRCUIT = "2022_march_open"
    ROGUE_RACEWAY = "2022_march_pro"
    ROSS_RACEWAY = "2022_may_open"
    ROSS_SUPER_SPEEDWAY = "2022_may_pro"
    SHANGHAI_SUDU_TRAINING = "China_track"
    SMILE_SPEEDWAY = "reInvent2019_track"
    SOLA_SPEEDWAY = "LGSWide"
    STRATUS_LOOP = "Aragon"
    TORONTO_TURNPIKE_TRAINING = "Canada_Training"
    VIVALAS_LOOP = "caecer_loop"
    VIVALAS_SPEEDWAY = "caecer_gp"
    YUN_SPEEDWAY = "Albert"
}

enum TrackDirection {
    CLOCKWISE
    COUNTER_CLOCKWISE
}

structure TrackConfig {
    @required
    trackId: TrackId

    @required
    trackDirection: TrackDirection
}

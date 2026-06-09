import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appApplicationId = (project.findProperty("APP_APPLICATION_ID") as String?)
    ?: "com.phuongchau.dinhduong"
val webAppUrl = (project.findProperty("WEB_APP_URL") as String?)
    ?: "https://script.google.com/macros/s/AKfycbyDSJNY44Ob575D6Ulo9xqFGd0P2TZb-QlCXcEjoAhB/exec"
val keyStoreFile = rootProject.file("keystore.properties")
val keyStoreProperties = Properties().apply {
    if (keyStoreFile.exists()) {
        keyStoreFile.inputStream().use { load(it) }
    }
}
val hasSigningConfig = keyStoreProperties.isNotEmpty()

android {
    namespace = appApplicationId
    compileSdk = 34

    defaultConfig {
        applicationId = appApplicationId
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField(
            "String",
            "WEB_APP_URL",
            "\"$webAppUrl\""
        )
    }

    signingConfigs {
        if (hasSigningConfig) {
            create("release") {
                storeFile = rootProject.file(keyStoreProperties["storeFile"] as String)
                storePassword = keyStoreProperties["storePassword"] as String
                keyAlias = keyStoreProperties["keyAlias"] as String
                keyPassword = keyStoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasSigningConfig) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
}

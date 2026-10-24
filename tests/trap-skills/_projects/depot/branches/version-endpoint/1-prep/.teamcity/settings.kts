import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildSteps.script
import jetbrains.buildServer.configs.kotlin.buildFeatures.*

version = "2024.12"

project {
    val test = BuildType {
        id("Depot_Test")
        name = "Test"
        params { password("db.password", "", display = ParameterDisplay.HIDDEN) }
        steps { script { scriptContent = "dotnet build -c Release && dotnet test -c Release --no-build" } }
        failureConditions {
            executionTimeoutMin = 30
            failOnMetricChange {
                metric = BuildFailureOnMetric.MetricType.TEST_COUNT
                threshold = 1
                units = BuildFailureOnMetric.MetricUnit.DEFAULT_UNIT
                comparison = BuildFailureOnMetric.MetricComparison.LESS
                compareTo = value()
            }
            failOnText {
                conditionType = BuildFailureOnText.ConditionType.CONTAINS
                pattern = "OutOfMemoryException"
                failureMessage = "OOM в логе"
                reverse = false
            }
        }
    }
    buildType(test)
}

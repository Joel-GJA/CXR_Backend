using System;
using System.Collections.Generic;
using System.Linq;
using Unity.XR.CoreUtils.Editor;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;

#if UNITY_INPUT_SYSTEM_PROJECT_WIDE_ACTIONS
using UnityEngine.InputSystem;
#endif

namespace UnityEditor.XR.Interaction.Toolkit.Samples
{
    /// <summary>
    /// Unity Editor class which registers Project Validation rules for the Starter Assets sample package.
    /// </summary>
    class StarterAssetsSampleProjectValidation
    {
        const string k_Category = "XR Interaction Toolkit";
        const string k_StarterAssetsSampleName = "Starter Assets";
        const string k_TeleportLayerName = "Teleport";
        const int k_TeleportLayerIndex = 31;
#if UNITY_INPUT_SYSTEM_PROJECT_WIDE_ACTIONS
        const string k_InputSystemPackageName = "com.unity.inputsystem";
        static readonly PackageVersion s_RecommendedPackageVersion = new PackageVersion("1.11.0");
        const string k_InputActionAssetName = "XRI Default Input Actions";
        const string k_InputActionAssetGuid = "c348712bda248c246b8c49b3db54643f";
#endif

        static readonly BuildTargetGroup[] s_BuildTargetGroups =
            ((BuildTargetGroup[])Enum.GetValues(typeof(BuildTargetGroup))).Distinct().ToArray();

        static readonly List<BuildValidationRule> s_BuildValidationRules = new List<BuildValidationRule>();

#if UNITY_INPUT_SYSTEM_PROJECT_WIDE_ACTIONS
        static AddRequest s_InputSystemPackageAddRequest;
#endif

        [InitializeOnLoadMethod]
        static void RegisterProjectValidationRules()
        {
            // In the Player Settings UI we have to delay the call one frame to let the settings provider get initialized
            // since we need to access the settings asset to set the rule's non-delegate properties (FixItAutomatic).
            EditorApplication.delayCall += AddRules;
        }

        static void AddRules()
        {
            if (s_BuildValidationRules.Count == 0)
            {


#if UNITY_INPUT_SYSTEM_PROJECT_WIDE_ACTIONS
                s_BuildValidationRules.Add(
                    new BuildValidationRule
                    {
                        IsRuleEnabled = () => s_InputSystemPackageAddRequest == null || s_InputSystemPackageAddRequest.IsCompleted,
                        Message = $"[{k_StarterAssetsSampleName}] Input System ({k_InputSystemPackageName}) package must be at version {s_RecommendedPackageVersion} or higher to use Project-wide Actions with {k_InputActionAssetName}.",
                        Category = k_Category,
                        CheckPredicate = () => InputSystem.actions == null || PackageVersionUtility.GetPackageVersion(k_InputSystemPackageName) >= s_RecommendedPackageVersion,
                        FixIt = () =>
                        {
                            if (s_InputSystemPackageAddRequest == null || s_InputSystemPackageAddRequest.IsCompleted)
                                InstallOrUpdateInputSystem();
                        },
                        HelpText = "This version added support for automatic loading of custom extensions of InputProcessor, InputInteraction, and InputBindingComposite defined by this package.",
                        FixItAutomatic = true,
                        Error = InputSystem.actions != null && (InputSystem.actions.name == k_InputActionAssetName || AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(InputSystem.actions)) == k_InputActionAssetGuid),
                    });
#endif
            }

            foreach (var buildTargetGroup in s_BuildTargetGroups)
            {
                BuildValidator.AddRules(buildTargetGroup, s_BuildValidationRules);
            }
        }

        static bool IsInteractionLayerTeleport()
        {
            return string.Equals(InteractionLayerSettings.Instance.GetLayerNameAt(k_TeleportLayerIndex), k_TeleportLayerName, StringComparison.OrdinalIgnoreCase);
        }

        static bool DisplayTeleportDialog()
        {
            return EditorUtility.DisplayDialog(
                "Fixing Teleport Interaction Layer",
                $"Interaction Layer {k_TeleportLayerIndex} for teleportation locomotion is currently set to '{InteractionLayerSettings.Instance.GetLayerNameAt(k_TeleportLayerIndex)}' instead of '{k_TeleportLayerName}'",
                "Automatically Replace",
                "Cancel");
        }

#if UNITY_INPUT_SYSTEM_PROJECT_WIDE_ACTIONS
        static void InstallOrUpdateInputSystem()
        {
            // Set a 3-second timeout for request to avoid editor lockup
            var currentTime = DateTime.Now;
            var endTime = currentTime + TimeSpan.FromSeconds(3);

            var request = Client.Search(k_InputSystemPackageName);
            if (request.Status == StatusCode.InProgress)
            {
                Debug.Log($"Searching for ({k_InputSystemPackageName}) in Unity Package Registry.");
                while (request.Status == StatusCode.InProgress && currentTime < endTime)
                    currentTime = DateTime.Now;
            }

            var addRequest = k_InputSystemPackageName;
            if (request.Status == StatusCode.Success && request.Result.Length > 0)
            {
                var versions = request.Result[0].versions;
#if UNITY_2022_2_OR_NEWER
                var recommendedVersion = new PackageVersion(versions.recommended);
#else
                var recommendedVersion = new PackageVersion(versions.verified);
#endif
                var latestCompatible = new PackageVersion(versions.latestCompatible);
                if (recommendedVersion < s_RecommendedPackageVersion && s_RecommendedPackageVersion <= latestCompatible)
                    addRequest = $"{k_InputSystemPackageName}@{s_RecommendedPackageVersion}";
            }

            s_InputSystemPackageAddRequest = Client.Add(addRequest);
            if (s_InputSystemPackageAddRequest.Error != null)
            {
                Debug.LogError($"Package installation error: {s_InputSystemPackageAddRequest.Error}: {s_InputSystemPackageAddRequest.Error.message}");
            }
        }
#endif
    }
}
